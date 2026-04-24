# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the Battery Pack Designer backend.

Run from the backend/ directory:
    pyinstaller backend.spec --noconfirm --clean
"""

from PyInstaller.utils.hooks import collect_all, collect_data_files

# reportlab bundles fonts and other binary data that PyInstaller misses
reportlab_datas, reportlab_binaries, reportlab_hidden = collect_all('reportlab')

a = Analysis(
    ['run.py'],
    pathex=['.'],
    binaries=reportlab_binaries,
    datas=[
        # The SQLite database with all 384 battery cells
        ('data', 'data'),
        # reportlab fonts, images, etc.
        *reportlab_datas,
    ],
    hiddenimports=[
        # uvicorn dynamically imports its event loop and protocol backends
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        # asyncio backend used by anyio (starlette's async layer)
        'anyio._backends._asyncio',
        # SQLAlchemy SQLite dialect (loaded via string at runtime)
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.dialects.sqlite.pysqlite',
        'sqlalchemy.sql.default_comparator',
        # h11 is uvicorn's HTTP/1.1 parser
        'h11',
        # email is used internally by several libs
        'email.mime.text',
        'email.mime.multipart',
        'email.mime.base',
        *reportlab_hidden,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Explicitly exclude heavy libraries that are NOT used by the server
    excludes=['pandas', 'numpy', 'matplotlib', 'tkinter',
              'notebook', 'IPython', 'jupyter'],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,   # UPX can corrupt binaries on Windows — keep off
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
    upx=False,
    upx_exclude=[],
    name='backend',
)
