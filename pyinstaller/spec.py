# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ["../src/opencode_orchestrator/electron_service.py"],
    pathex=[],
    binaries=[],
    datas=[
        ("../src/opencode_orchestrator", "opencode_orchestrator"),
    ],
    hiddenimports=[
        "opencode_orchestrator",
        "opencode_orchestrator.automation",
        "opencode_orchestrator.automation.state_machine",
        "opencode_orchestrator.automation.message_router",
        "opencode_orchestrator.automation.agent_manager",
        "opencode_orchestrator.automation.notification",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="opencode-orchestrator-service",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="opencode-orchestrator-service",
)
