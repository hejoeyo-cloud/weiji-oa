#!/usr/bin/env python3
"""一键构建部署包 — 前端构建 → 复制源码 → 组装 → 打包 zip

部署包是源码分发的（客户需要 Python 环境），不是 PyInstaller 单文件版。
PyInstaller 打包是可选步骤，如果 dist/ 下有 weiji-oa 可执行文件，会自动包含。

用法:
    python build_deploy.py              # 完整构建
    python build_deploy.py --skip-npm   # 跳过前端 npm run build（如果已构建）
    python build_deploy.py --skip-zip   # 跳过打包 zip（只更新目录）
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
DEPLOY_DIR = PROJECT_DIR / "微迹OA系统-部署包" / "weijioa-deploy"
BACKEND_DIR = PROJECT_DIR / "backend"
FRONTEND_DIR = PROJECT_DIR / "frontend"
TOOLS_DIR = PROJECT_DIR / "tools"
ZIP_PATH = PROJECT_DIR / "微迹OA系统-部署包" / "weijioa-deploy.zip"

# 复制 backend/ 时排除的目录/文件
BACKEND_EXCLUDES = {
    "__pycache__", "*.pyc", ".DS_Store",
    "logs", "nul",  # 运行时目录
}


def _should_exclude(name: str) -> bool:
    for pat in BACKEND_EXCLUDES:
        if pat.startswith("*"):
            if name.endswith(pat[1:]):
                return True
        elif name == pat:
            return True
    return False


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"\n==> Run: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd or PROJECT_DIR, shell=(sys.platform == "win32"))
    if result.returncode != 0:
        print(f"[ERROR] Command failed: {' '.join(cmd)}", file=sys.stderr)
        sys.exit(1)


def step_build_frontend() -> None:
    """1) 构建前端"""
    print("\n" + "=" * 60)
    print("步骤 1/4: 构建前端 (npm run build)")
    print("=" * 60)
    _run(["npm", "run", "build"], cwd=FRONTEND_DIR)


def step_assemble_deploy() -> None:
    """2) 组装部署包目录"""
    print("\n" + "=" * 60)
    print("步骤 2/4: 组装部署包")
    print("=" * 60)

    # 确保目标目录存在
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)

    # ── 复制 backend/（从源码目录，排除运行时文件） ──
    src_backend = BACKEND_DIR
    dst_backend = DEPLOY_DIR / "backend"
    if dst_backend.exists():
        shutil.rmtree(dst_backend)
    os.makedirs(dst_backend)

    for root, dirs, files in os.walk(src_backend):
        # 排除 __pycache__ 等目录
        dirs[:] = [d for d in dirs if not _should_exclude(d)]
        # 计算相对路径
        rel = os.path.relpath(root, src_backend)
        dst_root = dst_backend if rel == "." else dst_backend / rel
        os.makedirs(dst_root, exist_ok=True)
        for f in files:
            if _should_exclude(f):
                continue
            shutil.copy2(os.path.join(root, f), dst_root / f)
    print(f"  [OK] backend/  → {dst_backend}")

    # ── 复制 frontend/dist/（从前端构建输出） ──
    src_frontend = FRONTEND_DIR / "dist"
    dst_frontend = DEPLOY_DIR / "frontend" / "dist"
    if src_frontend.exists():
        if dst_frontend.exists():
            shutil.rmtree(dst_frontend)
        dst_frontend.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src_frontend, dst_frontend)
        print(f"  [OK] frontend/dist/  → {dst_frontend}")
    else:
        print(f"  [WARN] 未找到 {src_frontend}，跳过 frontend/dist/")

    # ── 复制 tools/ ──
    src_tools = TOOLS_DIR
    dst_tools = DEPLOY_DIR / "tools"
    if src_tools.exists():
        if dst_tools.exists():
            shutil.rmtree(dst_tools)
        shutil.copytree(src_tools, dst_tools, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        print(f"  [OK] tools/  → {dst_tools}")
    else:
        print(f"  [WARN] 未找到 {src_tools}，跳过 tools/")

    # ── 复制根目录文件 ──
    for fname in ["start.bat", "install.bat", "README.txt"]:
        src = PROJECT_DIR / fname
        dst = DEPLOY_DIR / fname
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  [OK] {fname}  → {dst}")
        else:
            print(f"  [WARN] 未找到 {fname}，跳过")

    # ── ★ 关键：同步 version.json（从根目录复制到部署包） ──
    src_ver = PROJECT_DIR / "version.json"
    dst_ver = DEPLOY_DIR / "version.json"
    if src_ver.exists():
        shutil.copy2(src_ver, dst_ver)
        try:
            with open(src_ver) as f:
                ver_data = json.load(f)
            print(f"  [OK] version.json  → {dst_ver} (v{ver_data.get('version', '?')})")
        except Exception:
            print(f"  [OK] version.json  → {dst_ver}")
    else:
        print(f"  [WARN] 未找到 version.json，跳过")

    # ── 可选：复制 PyInstaller 可执行文件（如果存在） ──
    pyi_exe = PROJECT_DIR / "dist" / "weiji-oa"
    if pyi_exe.exists():
        # Windows 上可能是 weiji-oa.exe，macOS 上是 weiji-oa
        exe_name = "weiji-oa.exe" if sys.platform == "win32" else "weiji-oa"
        shutil.copy2(pyi_exe, DEPLOY_DIR / exe_name)
        print(f"  [OK] {exe_name}  → {DEPLOY_DIR}")
    else:
        exe_win = PROJECT_DIR / "dist" / "weiji-oa.exe"
        if exe_win.exists():
            shutil.copy2(exe_win, DEPLOY_DIR / "weiji-oa.exe")
            print(f"  [OK] weiji-oa.exe  → {DEPLOY_DIR}")


def step_create_zip() -> None:
    """3) 打包为 zip"""
    print("\n" + "=" * 60)
    print("步骤 3/3: 打包 zip")
    print("=" * 60)

    # 检查部署包目录是否完整
    required = ["backend", "frontend", "version.json", "start.bat", "install.bat", "README.txt"]
    missing = [r for r in required if not (DEPLOY_DIR / r).exists()]
    if missing:
        print(f"  [WARN] 部署包缺少以下文件/目录: {', '.join(missing)}")
        ans = input("  继续打包？(y/N): ").strip().lower()
        if ans != "y":
            print("  已取消打包")
            return

    # 删除旧 zip
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
        print(f"  [OK] 删除旧 zip: {ZIP_PATH}")

    # 创建新 zip（排除 .DS_Store）
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(DEPLOY_DIR):
            # 排除 .DS_Store
            dirs[:] = [d for d in dirs if d != ".DS_Store"]
            for file in files:
                if file == ".DS_Store":
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, DEPLOY_DIR)
                zf.write(file_path, arcname)

    print(f"  [OK] 打包完成: {ZIP_PATH}")
    size = ZIP_PATH.stat().st_size / (1024 * 1024)
    print(f"  [OK] 大小: {size:.1f} MB")


def main():
    parser = argparse.ArgumentParser(description="一键构建微迹OA部署包")
    parser.add_argument("--skip-npm", action="store_true", help="跳过前端 npm run build")
    parser.add_argument("--skip-zip", action="store_true", help="跳过打包 zip")
    args = parser.parse_args()

    print("=" * 60)
    print("  微迹OA 部署包构建工具")
    print("=" * 60)

    if not args.skip_npm:
        step_build_frontend()
    else:
        print("\n[SKIP] 跳过前端构建")

    step_assemble_deploy()

    if not args.skip_zip:
        step_create_zip()
    else:
        print("\n[SKIP] 跳过打包 zip")

    print("\n" + "=" * 60)
    print("  ✅ 部署包构建完成！")
    print(f"  目录: {DEPLOY_DIR}")
    print(f"  Zip:  {ZIP_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()