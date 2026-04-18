# ============================================================
# Battery Pack Designer — Full Build Script
# Usage: Right-click → "Run with PowerShell"  OR  .\build.ps1
# Output: frontend\release\Battery Pack Designer Setup 1.0.0.exe
# ============================================================

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    ERROR: $msg" -ForegroundColor Red; exit 1 }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Battery Pack Designer — Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── Step 1: Build the Python backend ─────────────────────────────────────────
Write-Step "Step 1/2 — Building Python backend (PyInstaller)"

$BackendDir  = Join-Path $Root "backend"
$VenvPython  = Join-Path $BackendDir "venv\Scripts\python.exe"
$VenvPip     = Join-Path $BackendDir "venv\Scripts\pip.exe"
$VenvPyInst  = Join-Path $BackendDir "venv\Scripts\pyinstaller.exe"
$SpecFile    = Join-Path $BackendDir "backend.spec"
$BackendExe  = Join-Path $BackendDir "dist\backend\backend.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Fail "Backend venv not found at $VenvPython`nCreate it with:`n  cd backend && python -m venv venv && venv\Scripts\pip install -r requirements.txt"
}

# Install PyInstaller into the venv if missing
if (-not (Test-Path $VenvPyInst)) {
    Write-Host "    Installing PyInstaller into backend venv..."
    & $VenvPip install pyinstaller --quiet
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to install PyInstaller" }
}

# Run PyInstaller from the backend directory using the venv's Python
Push-Location $BackendDir
try {
    & $VenvPyInst $SpecFile --noconfirm --clean
    if ($LASTEXITCODE -ne 0) { Write-Fail "PyInstaller failed" }
} finally {
    Pop-Location
}

if (-not (Test-Path $BackendExe)) {
    Write-Fail "backend.exe not found after build — check PyInstaller output above"
}
Write-OK "Backend built: $BackendExe"

# ── Step 2: Build the Electron installer ──────────────────────────────────────
Write-Step "Step 2/2 — Building Electron installer"

$FrontendDir = Join-Path $Root "frontend"
Push-Location $FrontendDir
try {
    Write-Host "    npm install..."
    npm install --prefer-offline 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { npm install; if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" } }

    Write-Host "    npm run electron:build:win..."
    npm run electron:build:win
    if ($LASTEXITCODE -ne 0) { Write-Fail "electron-builder failed" }
} finally {
    Pop-Location
}

$Installer = Join-Path $FrontendDir "release\Battery Pack Designer Setup 1.0.0.exe"
if (-not (Test-Path $Installer)) {
    # Try to find it even if version differs
    $Found = Get-ChildItem (Join-Path $FrontendDir "release") -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($Found) { $Installer = $Found.FullName }
    else { Write-Fail "Installer .exe not found in frontend\release\" }
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "  Installer: $Installer" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
