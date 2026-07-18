"""自动更新服务 — 检查更新、下载、校验、解压、备份、替换文件、重启"""
import hashlib
import os
import shutil
import subprocess
import sys

import httpx

from config import PROJECT_DIR, UPDATE_CHECK_URL_GITHUB, UPDATE_CHECK_URL_GITEE
from version import get_current_version

STAGING_DIR_NAME = "update_staging"


class UpdaterError(Exception):
    """更新过程中的错误"""
    pass


# ── 版本比较 ────────────────────────────────────────────────────────

def _version_gt(a: str, b: str) -> bool:
    """简单语义化版本比较，a > b 返回 True"""
    try:
        parts_a = [int(x) for x in str(a).strip().split(".")]
        parts_b = [int(x) for x in str(b).strip().split(".")]
    except (ValueError, AttributeError):
        return False
    while len(parts_a) < len(parts_b):
        parts_a.append(0)
    while len(parts_b) < len(parts_a):
        parts_b.append(0)
    for x, y in zip(parts_a, parts_b):
        if x > y:
            return True
        if x < y:
            return False
    return False


# ── 检查更新（异步并行请求 GitHub + Gitee） ─────────────────────────

async def _fetch_version_json(client: httpx.AsyncClient, source: str, url: str) -> dict:
    """从指定 URL 获取 version.json"""
    resp = await client.get(url)
    resp.raise_for_status()
    data = resp.json()
    data["_source"] = source
    return data


async def check_for_update() -> dict:
    """并行请求 GitHub 和 Gitee，任一个成功即可，返回更新检查结果"""
    import asyncio

    current = get_current_version()
    current_ver = current.get("version", "0.0.0")

    urls = []
    if UPDATE_CHECK_URL_GITEE:
        urls.append(("gitee", UPDATE_CHECK_URL_GITEE))
    if UPDATE_CHECK_URL_GITHUB:
        urls.append(("github", UPDATE_CHECK_URL_GITHUB))

    if not urls:
        raise UpdaterError("未配置任何更新源")

    remote = None
    source = None
    errors = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=10.0), follow_redirects=True) as client:
        tasks = [_fetch_version_json(client, src, url) for src, url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for (src, _), r in zip(urls, results):
        if isinstance(r, dict):
            remote = r
            source = src
            break
        elif isinstance(r, Exception):
            errors.append(f"{src}: {r}")

    if remote is None:
        detail = "; ".join(errors) if errors else "未知错误"
        raise UpdaterError(f"无法连接到任何更新源 ({detail})")

    latest_ver = remote.get("version", "0.0.0")
    has_update = _version_gt(latest_ver, current_ver)

    return {
        "has_update": has_update,
        "current_version": current_ver,
        "latest_version": latest_ver,
        "changelog": remote.get("changelog", ""),
        "release_date": remote.get("release_date", ""),
        "download_url": remote.get(
            "download_url_github" if source == "github" else "download_url_gitee", ""
        ),
        "sha256": remote.get("sha256", ""),
        "source": source,
    }


# ── 应用更新 ────────────────────────────────────────────────────────

def _compute_sha256(path: str) -> str:
    """计算文件 SHA256"""
    sha = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


def _download_file(url: str, dest: str) -> None:
    """流式下载文件"""
    with httpx.stream("GET", url, timeout=300, follow_redirects=True) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=65536):
                f.write(chunk)


def _create_backup(old_version: str) -> str:
    """备份当前 backend/、frontend/dist/、tools/ 到 backups/"""
    backup_dir = os.path.join(PROJECT_DIR, "backups", f"update_backup_v{old_version}")
    os.makedirs(backup_dir, exist_ok=True)

    dirs = [
        ("backend", os.path.join(PROJECT_DIR, "backend")),
        ("frontend_dist", os.path.join(PROJECT_DIR, "frontend", "dist")),
        ("tools", os.path.join(PROJECT_DIR, "tools")),
    ]

    for name, src in dirs:
        if os.path.exists(src):
            dst = os.path.join(backup_dir, name)
            shutil.copytree(src, dst, dirs_exist_ok=True)
            print(f"[updater] Backup: {name} OK")

    print(f"[updater] Backup created at {backup_dir}")
    return backup_dir


def _replace_files(staging_dir: str) -> None:
    """用 staging 中的新文件替换项目中的旧文件（Python 进程内完成）"""
    pairs = [
        ("backend", os.path.join(PROJECT_DIR, "backend")),
        ("frontend/dist", os.path.join(PROJECT_DIR, "frontend", "dist")),
    ]

    for src_rel, dst in pairs:
        src = os.path.join(staging_dir, src_rel)
        if not os.path.exists(src):
            continue
        # 清空目标目录后复制新文件进去
        for item in os.listdir(dst):
            item_path = os.path.join(dst, item)
            if os.path.isdir(item_path) and not os.path.islink(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
        shutil.copytree(src, dst, dirs_exist_ok=True)
        print(f"[updater] Replaced: {src_rel}")

    # tools
    tools_src = os.path.join(staging_dir, "tools")
    tools_dst = os.path.join(PROJECT_DIR, "tools")
    if os.path.exists(tools_src):
        for item in os.listdir(tools_src):
            s = os.path.join(tools_src, item)
            d = os.path.join(tools_dst, item)
            if os.path.isdir(s):
                if os.path.exists(d):
                    shutil.rmtree(d)
                shutil.copytree(s, d)
            else:
                shutil.copy2(s, d)
        print("[updater] Replaced: tools")

    # version.json
    ver_src = os.path.join(staging_dir, "version.json")
    if os.path.exists(ver_src):
        shutil.copy2(ver_src, os.path.join(PROJECT_DIR, "version.json"))
        print("[updater] Replaced: version.json")

    # 清理 __pycache__
    for root, dirs, _ in os.walk(os.path.join(PROJECT_DIR, "backend")):
        for d in dirs:
            if d == "__pycache__":
                shutil.rmtree(os.path.join(root, d), ignore_errors=True)
    print("[updater] Cleaned __pycache__")


def _generate_restart_bat() -> str:
    """生成极简重启脚本 — 只负责等待 + 启动 start.bat"""
    content = (
        "@echo off\r\n"
        "timeout /t 3 /nobreak >nul\r\n"
        'cd /d "%~dp0"\r\n'
        'start "" start.bat\r\n'
    )
    bat_path = os.path.join(PROJECT_DIR, "_restart.bat")
    with open(bat_path, "w", encoding="ascii") as f:
        f.write(content)
    print(f"[updater] Generated restart script: {bat_path}")
    return bat_path


def apply_update(download_url: str, expected_sha256: str) -> dict:
    """下载、校验、解压、备份、替换文件、启动重启脚本

    核心思路：文件替换全部在 Python 中完成，重启脚本只做"等待 + 启动 start.bat"。
    """
    current = get_current_version()
    old_ver = current.get("version", "0.0.0")

    staging_dir = os.path.join(PROJECT_DIR, STAGING_DIR_NAME)

    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir)
    os.makedirs(staging_dir)

    # 1) 下载
    zip_path = os.path.join(staging_dir, "update.zip")
    print(f"[updater] Downloading from {download_url} ...")
    _download_file(download_url, zip_path)
    print(f"[updater] Downloaded: {os.path.getsize(zip_path)} bytes")

    # 2) 校验 SHA256
    actual_sha = _compute_sha256(zip_path)
    if actual_sha.lower() != expected_sha256.lower():
        os.remove(zip_path)
        shutil.rmtree(staging_dir)
        raise UpdaterError(
            f"SHA256 校验失败。期望 {expected_sha256[:16]}..., 实际 {actual_sha[:16]}..."
        )
    print(f"[updater] SHA256 OK: {actual_sha[:16]}...")

    # 3) 解压
    shutil.unpack_archive(zip_path, staging_dir)
    os.remove(zip_path)
    print("[updater] Extracted to staging")

    # 4) 备份
    _create_backup(old_ver)

    # 5) Python 直接替换文件
    _replace_files(staging_dir)

    # 6) 清理 staging
    shutil.rmtree(staging_dir)

    # 7) 生成重启脚本并启动
    restart_bat = _generate_restart_bat()

    if sys.platform == "win32":
        CREATE_NO_WINDOW = 0x08000000
        DETACHED_PROCESS = 0x00000008
        subprocess.Popen(
            ["cmd", "/c", restart_bat],
            creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS,
            close_fds=True,
        )
    else:
        subprocess.Popen(
            ["bash", "-c",
             f'sleep 3; cd "{PROJECT_DIR}/backend" 2>/dev/null; python3 main.py &'],
            start_new_session=True,
            close_fds=True,
        )

    print("[updater] Restart triggered. Old process will exit now.")
    os._exit(0)


# ── 定时自动更新（供 APScheduler 调用） ──────────────────────────────

def auto_update_check():
    """定时检查更新，发现有新版本则自动执行更新。"""
    import asyncio
    from config import AUTO_UPDATE_ENABLED

    if not AUTO_UPDATE_ENABLED:
        return

    try:
        result = asyncio.run(check_for_update())
    except UpdaterError as e:
        print(f"[auto-update] Check failed: {e}")
        return
    except Exception as e:
        print(f"[auto-update] Unexpected error: {e}")
        return

    if not result.get("has_update"):
        print(f"[auto-update] Already up to date (v{result.get('current_version')})")
        return

    print(f"[auto-update] New version v{result['latest_version']} found, applying...")
    try:
        apply_update(result["download_url"], result["sha256"])
    except UpdaterError as e:
        print(f"[auto-update] Apply failed: {e}")
    except Exception as e:
        print(f"[auto-update] Unexpected error during apply: {e}")
