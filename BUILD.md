# Battery Pack Designer — Build & Distribution Guide

## What this produces

A standalone desktop installer (`.exe` on Windows, `.dmg` on Mac, `.AppImage` on Linux).  
The user **double-clicks the installer → installs → opens the app**.  
No Python, no Node.js, no terminal — everything is bundled inside.

---

## How it works at runtime

```
User double-clicks "Battery Pack Designer"
        │
        ▼
  Electron starts
        │
        ├─ Shows "Starting backend…" loading screen immediately
        │
        ├─ Spawns the bundled FastAPI backend (resources/backend/backend.exe)
        │
        ├─ Polls http://localhost:8000/api/v1/health until ready (~3–5 sec)
        │
        └─ Loads the React frontend → user sees the app
```

The backend runs silently in the background and is killed automatically when the app closes.

---

## Prerequisites (developer machine only)

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Build backend |
| Node.js | 18+ | Build frontend + Electron |
| pip | latest | Install Python deps |

The **target user's machine needs nothing** — everything is bundled.

---

## Build steps

### Step 1 — Build the Python backend

Open PowerShell in the project root:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install pyinstaller
pyinstaller --onedir --name backend --add-data "data;data" --paths . app/main.py
```

This produces:
```
backend/dist/backend/
├── backend.exe        ← the FastAPI server
└── _internal/         ← Python runtime + all libraries + SQLite DB
```

> Only re-run this step when the backend code changes.

---

### Step 2 — Build the Electron installer

```powershell
cd frontend
npm install
npm run electron:build:win
```

This produces:
```
frontend/release/
└── Battery Pack Designer Setup 1.0.0.exe   ← send this to users
```

> This step bundles the frontend (React/Three.js) + Electron + the backend from Step 1 into one installer.

---

## Full build (copy-paste)

```powershell
# From project root

# 1. Backend
cd backend
.\venv\Scripts\Activate.ps1
pyinstaller --onedir --name backend --add-data "data;data" --paths . app/main.py
deactivate

# 2. Frontend + installer
cd ..\frontend
npm install
npm run electron:build:win
```

Installer is at: `frontend/release/Battery Pack Designer Setup 1.0.0.exe`

---

## Distributing to users

1. Copy `frontend/release/Battery Pack Designer Setup 1.0.0.exe` to a USB drive or file share
2. User double-clicks it → standard Windows installer wizard
3. After install, a desktop shortcut is created
4. User opens the app — backend starts automatically, app is ready in ~5 seconds

---

## Rebuilding after changes

| What changed | Steps needed |
|---|---|
| Backend code (Python) | Step 1 + Step 2 |
| Frontend code (React/JS) | Step 2 only |
| Both | Step 1 + Step 2 |

---

## Troubleshooting

**"Backend binary not found" error on launch**  
→ Step 1 was not run. Run the PyInstaller command and rebuild.

**App opens then immediately closes**  
→ Port 8000 is in use by another process. Close it and relaunch.

**Installer blocked by Windows Defender**  
→ Normal for unsigned apps. Click "More info" → "Run anyway".  
→ Long-term fix: code-sign the executable with a certificate.

**Black screen on launch**  
→ Wait 10 seconds — the backend is still starting.  
→ If it persists, reinstall the app.

---

## Platform builds (future)

```powershell
# Mac (must run on a Mac machine)
npm run electron:build:mac

# Linux (must run on a Linux machine)
npm run electron:build:linux
```

Each platform's PyInstaller binary must be built **on that platform** — you cannot cross-compile.
