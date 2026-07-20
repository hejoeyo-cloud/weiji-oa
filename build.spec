# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller build spec for 微迹OA (WeiJiOA).

Bundles all backend modules + frontend/dist/ + public.pem.
Excludes heavy third-party packages not needed at runtime.
"""

import os
from pathlib import Path

PROJECT_DIR = Path(SPECPATH)
BACKEND_DIR = PROJECT_DIR / "backend"
FRONTEND_DIST = PROJECT_DIR / "frontend" / "dist"

# ── Data files (2-tuples for Analysis) ──────────────────────────────────
datas = []

# Frontend static files
if FRONTEND_DIST.exists():
    datas.append((str(FRONTEND_DIST), "frontend/dist"))

# License public key
_pubkey = BACKEND_DIR / "keys" / "public.pem"
if _pubkey.exists():
    datas.append((str(_pubkey), "backend/keys"))

# ── Excluded packages ──────────────────────────────────────────────────
excludes = [
    "numpy", "pandas", "matplotlib", "tkinter",
    "PIL", "pillow", "scipy", "tensorflow", "torch", "sklearn",
    "jedi", "IPython", "jupyter", "notebook",
]

a = Analysis(
    [str(BACKEND_DIR / "main.py")],
    pathex=[str(PROJECT_DIR), str(BACKEND_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)

# Append backend sub-packages as Trees (TOC 3-tuples)
for _sub in ["models", "routers", "schemas", "services", "middleware", "websocket"]:
    _pkg_path = BACKEND_DIR / _sub
    if _pkg_path.exists():
        a.datas += Tree(str(_pkg_path), prefix=_sub, excludes=["*.pyc", "__pycache__"])

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="weiji-oa",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
