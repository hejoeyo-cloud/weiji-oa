"""自动更新服务 — 检查更新、下载、校验、解压、备份、生成更新脚本"""
import hashlib
import os
import shutil
import subprocess
import sys

import httpx

from config import PROJECT_DIR, UPDATE_CHECK_URL_GITHUB, UPDATE_CHECK_URL_GITEE
from version import get_current_version

UPDATER_BAT_NAME = "updater.bat"
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
    # 补齐长度
    while len(parts_a) < len(parts_b):
        parts_a.append(0)
    while len(parts_b) < len(parts_a):
        parts_b.append(0)
    for x, y in zip(parts_a, parts_b):
        if x > y:
            return True
        if x < y:
            return False
    return False  # 完全相等


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
    if UPDATE_CHECK_URL_GITHUB:
        urls.append(("github", UPDATE_CHECK_URL_GITHUB))
    if UPDATE_CHECK_URL_GITEE:
        urls.append(("gitee", UPDATE_CHECK_URL_GITEE))

    if not urls:
        raise UpdaterError("未配置任何更新源，请设置环境变量 UPDATE_CHECK_URL_GITHUB 或 UPDATE_CHECK_URL_GITEE")

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
        "download_url": remote.get("download_url_github" if source == "github" else "download_url_gitee", ""),
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
    """备份当前 backend/ 和 frontend/dist/，返回备份目录路径"""
    backup_dir = os.path.join(PROJECT_DIR, "backups", f"update_backup_v{old_version}")
    os.makedirs(backup_dir, exist_ok=True)

    src_dirs = [
        ("backend", os.path.join(PROJECT_DIR, "backend")),
        ("frontend", os.path.join(PROJECT_DIR, "frontend", "dist")),
        ("tools", os.path.join(PROJECT_DIR, "tools")),
    ]

    for name, src in src_dirs:
        if os.path.exists(src):
            dst = os.path.join(backup_dir, name)
            # copytree with dirs_exist_ok=True for Python 3.8+
            shutil.copytree(src, dst, dirs_exist_ok=True)
            print(f"[updater] Backup: {name} → {dst}")

    print(f"[updater] Backup created: {backup_dir}")
    return backup_dir


# ── updater.bat 模板 ─────────────────────────────────────────────────

UPDATER_BAT_TEMPLATE = """@echo off
setlocal enabledelayedexpansion

set "APP_DIR=%~1"
set "STAGING_DIR=%~2"
set "PID=%~3"

echo [Updater] Waiting 10 seconds for HTTP response to complete...
timeout /t 10 /nobreak >nul

echo [Updater] Stopping old application...
taskkill /PID %PID% /F >nul 2>&1
timeout /t 3 /nobreak >nul

echo [Updater] Installing update...

robocopy "%STAGING_DIR%\\backend" "%APP_DIR%\\backend" /E /IS /NFL /NDL /NJH /NJS /NP
if %errorlevel% geq 8 (
    echo [Updater] ERROR: Failed to update backend files (errorlevel=%errorlevel%)
    goto :error
)

robocopy "%STAGING_DIR%\\frontend\\dist" "%APP_DIR%\\frontend\\dist" /E /IS /NFL /NDL /NJH /NJS /NP
if %errorlevel% geq 8 (
    echo [Updater] ERROR: Failed to update frontend files (errorlevel=%errorlevel%)
    goto :error
)

if exist "%STAGING_DIR%\\tools" (
    robocopy "%STAGING_DIR%\\tools" "%APP_DIR%\\tools" /E /IS /NFL /NDL /NJH /NJS /NP
)

if exist "%STAGING_DIR%\\version.json" (
    copy /Y "%STAGING_DIR%\\version.json" "%APP_DIR%\\version.json" >nul
)

echo [Updater] Cleaning up Python cache...
for /d /r "%APP_DIR%\\backend" %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d" 2>nul

echo [Updater] Removing staging files...
rmdir /s /q "%STAGING_DIR%" 2>nul

echo [Updater] Starting new version...
cd /d "%APP_DIR%"
start "" start.bat

echo [Updater] Update complete!
exit /b 0

:error
echo [Updater] Update failed! You can restore from: %APP_DIR%\\backups\\
pause
exit /b 1
"""


def _generate_updater_bat(app_dir: str, staging_dir: str) -> str:
    """生成 updater.bat 到项目根目录"""
    bat_path = os.path.join(app_dir, UPDATER_BAT_NAME)
    with open(bat_path, "w", encoding="ascii") as f:
        f.write(UPDATER_BAT_TEMPLATE)
    print(f"[updater] Generated: {bat_path}")
    return bat_path


def apply_update(download_url: str, expected_sha256: str) -> dict:
    """下载更新包、校验、解压、备份、启动 updater.bat

    此函数在后台线程中执行，启动 updater.bat 后不返回。
    """
    current = get_current_version()
    old_ver = current.get("version", "0.0.0")

    staging_dir = os.path.join(PROJECT_DIR, STAGING_DIR_NAME)

    # 清理并创建临时目录
    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir)
    os.makedirs(staging_dir)

    # 1) 下载更新包
    zip_path = os.path.join(staging_dir, "update.zip")
    print(f"[updater] Downloading update from {download_url} ...")
    _download_file(download_url, zip_path)
    print(f"[updater] Downloaded: {zip_path}")

    # 2) 校验 SHA256
    actual_sha = _compute_sha256(zip_path)
    if actual_sha.lower() != expected_sha256.lower():
        os.remove(zip_path)
        shutil.rmtree(staging_dir)
        raise UpdaterError(
            f"SHA256 校验失败。"
            f"期望 {expected_sha256[:16]}..., 实际 {actual_sha[:16]}..."
        )
    print(f"[updater] SHA256 verified: {actual_sha[:16]}...")

    # 3) 解压
    shutil.unpack_archive(zip_path, staging_dir)
    os.remove(zip_path)
    print(f"[updater] Extracted to: {staging_dir}")

    # 4) 备份当前版本
    _create_backup(old_ver)

    # 5) 生成 updater.bat
    _generate_updater_bat(PROJECT_DIR, staging_dir)

    # 6) 启动 updater.bat（独立进程）
    bat_path = os.path.join(PROJECT_DIR, UPDATER_BAT_NAME)
    pid = os.getpid()

    if sys.platform == "win32":
        CREATE_NO_WINDOW = 0x08000000
        DETACHED_PROCESS = 0x00000008
        subprocess.Popen(
            ["cmd", "/c", bat_path, PROJECT_DIR, staging_dir, str(pid)],
            creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS,
            close_fds=True,
        )
    else:
        subprocess.Popen(
            ["bash", bat_path, PROJECT_DIR, staging_dir, str(pid)],
            start_new_session=True,
            close_fds=True,
        )

    print(f"[updater] Launched updater.bat, PID {pid} will be terminated by updater")

    return {"status": "installing"}


# ── 定时自动更新（供 APScheduler 调用） ──────────────────────────────

def auto_update_check():
    """定时检查更新，发现有新版本则自动执行更新。

    由 APScheduler 后台线程调用，内部用 asyncio.run() 执行异步检查。
    """
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
