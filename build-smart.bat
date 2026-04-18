@echo off
title Battery Pack Designer — Smart Build
color 0B
echo.
echo  ============================================
echo   Battery Pack Designer — Smart Build
echo   Detecting what changed...
echo  ============================================
echo.

cd /d "%~dp0"

:: Check if any backend Python files changed (staged or unstaged)
git diff --name-only HEAD 2>nul | findstr /I "backend/app" >nul 2>&1
if %errorlevel% == 0 goto full_build

git diff --name-only 2>nul | findstr /I "backend/app" >nul 2>&1
if %errorlevel% == 0 goto full_build

goto fast_build

:full_build
echo  Detected backend changes → running Full Build
echo.
call "%~dp0build-full.bat"
goto end

:fast_build
echo  No backend changes → running Fast Build
echo.
call "%~dp0build-fast.bat"
goto end

:end
