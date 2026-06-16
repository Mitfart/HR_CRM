# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

scripts_dir = Path(SPECPATH)

a = Analysis(
    [str(scripts_dir / "launcher_gui.py")],
    pathex=[str(scripts_dir)],
    binaries=[],
    datas=[],
    hiddenimports=["web_data_extractor"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="WebDataExtractorLauncher",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="WebDataExtractorLauncher",
)

app = BUNDLE(
    coll,
    name="WebDataExtractorLauncher.app",
    icon=None,
    bundle_identifier="agency.goodpeople.webdataextractor",
)
