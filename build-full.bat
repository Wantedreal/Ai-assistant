@echo off
title Battery Pack Designer — Full Build
color 0B
echo.
echo  ============================================
echo   Battery Pack Designer — Full Build
echo   (Backend + Frontend — use when Python changed)
echo  ============================================
echo.

cd /d "%~dp0backend"

echo  [1/3] Building Python backend (PyInstaller)...
call venv\Scripts\pyinstaller.exe backend.spec --noconfirm --clean
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: PyInstaller failed. Check the output above.
    pause
    exit /b 1
)

if not exist "dist\backend\backend.exe" (
    color 0C
    echo.
    echo  ERROR: backend.exe not found after build.
    pause
    exit /b 1
)

echo.
echo  [2/3] Building React frontend...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Vite build failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo  [3/3] Packaging Electron installer...
set CSC_IDENTITY_AUTO_DISCOVERY=false

:: Run full packager — it creates win-unpacked before winCodeSign is invoked
:: Exit code will be non-zero due to winCodeSign symlink issue on this machine, that is expected
call npx electron-builder --win
:: Do NOT check errorlevel here — winCodeSign failure is expected without Developer Mode

:: Verify the packaged app exists
if not exist "release\win-unpacked\Battery Pack Designer.exe" (
    color 0C
    echo.
    echo  ERROR: Electron packaging failed — app exe not found in win-unpacked.
    pause
    exit /b 1
)

:: Create NSIS installer from the packaged directory — does not need winCodeSign
call npx electron-builder --win nsis --prepackaged release\win-unpacked
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Electron installer creation failed. Check the output above.
    pause
    exit /b 1
)

echo.
color 0A
echo  ============================================
echo   Done! Installer ready:
echo   frontend\release\Battery Pack Designer Setup 1.0.0.exe
echo  ============================================
echo.
pause
