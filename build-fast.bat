@echo off
title Battery Pack Designer — Frontend Build
color 0B
echo.
echo  ============================================
echo   Battery Pack Designer — Fast Build
echo   (Frontend only — use when JS/React changed)
echo  ============================================
echo.

cd /d "%~dp0frontend"

echo  [1/2] Building React frontend...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Vite build failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo  [2/2] Packaging Electron installer...
call npx electron-builder --win
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Electron build failed. Check the output above.
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
