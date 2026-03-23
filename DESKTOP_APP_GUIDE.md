# Desktop Application Architecture Guide

This document explains the transition of the web application into a standalone Windows desktop executable, the underlying technologies, and how to maintain it.

## 🛠️ Technologies Used

To wrap our existing web application into a desktop application without writing everything from scratch, we used two main technologies:

1. **Electron Framework**: A framework that allows creating native desktop applications with web technologies (HTML, CSS, JavaScript/React). It embeds a Chromium browser (to render the frontend) and Node.js (to handle system-level operations like launching our Python backend).
2. **PyInstaller**: A tool for bundling the Python FastApi application and all of its dependencies (like `site-packages`, logic, and the SQLite `data` folder) into a single, standalone executable package that does not require the user to install Python on their computer.
3. **Electron-Builder**: A complete solution used to package the final Electron application (which includes the built React frontend + the bundled PyInstaller backend executable) into an installer (`.exe`) that the end-user can easily distribute and run.

---

## 📁 New Files and Folders Created

Here is a breakdown of the new files introduced to make the desktop app possible, and why they exist:

### 1. `frontend/electron/main.cjs`
- **Why it exists**: This is the "Main Process" of the Electron app. It is responsible for controlling the lifecycle of the application (opening windows, creating menus, handling quit events). Crucially, this script also automatically runs our `backend.exe` (FastAPI) in the background before the window is opened.

### 2. `frontend/electron/preload.js`
- **Why it exists**: Electron has strict security models. The frontend React code runs in an isolated browser environment and isn't allowed to access the system (Node.js) directly. The `preload.js` acts as a secure bridge that safely exposes only necessary system information or methods to the React frontend (like `window.electronAPI.platform`). This was extremely useful for detecting if the app was running inside Electron versus a standard web browser to apply WebGL/Three.js fixes.

### 3. `frontend/package.json` Updates
- **Why it exists**: We added dependencies like `electron` and `electron-builder` to the existing React `package.json`. Additionally, we added a `"build"` configuration block that tells `electron-builder` where the frontend code is, where the backend executable is (in `extraResources`), and how to generate the installer (NSIS Windows Setup).

### 4. `frontend/release/`
- **Why it exists**: This folder is automatically generated when you package the app. It holds your final deliverable distributable installer (e.g., `Battery Pack Designer Setup 1.0.0.exe`).

---

## 🌍 Is this runnable on every PC?

**Yes.** By combining PyInstaller and Electron, the resulting installer is completely self-contained. 
- The end-user **does not** need to install Python.
- The end-user **does not** need to install Node.js, `npm`, Vite, or any JavaScript libraries.
- The end-user **does not** need a web server.
- The SQLite database is already packaged alongside the application.

They simply double-click the setup `.exe`, let it install, and launch the application just like any normal Windows program. The internal scripts automatically launch the hidden local FastApi server and connect the React frontend to it.

> **Note**: This specific build is targeted for Windows 64-bit (`win32-x64`). To run it on macOS or Linux, you would need to run the build steps on a Mac or Linux machine respectively.

---

## 🔄 How to Ship Changes to Production

If you modify the Python source code or the React frontend, you need to repackage the application. Follow these steps exactly in the order presented to generate a new installer.

### Step 1: Rebuild the Python Backend
Whenever you change `backend/app/main.py` or any Python models/logic, you must rebuild the standalone backend binary.

Open a PowerShell terminal and run:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pyinstaller --onedir --name backend --add-data "data;data" --paths . app/main.py
```
*Wait for this process to print "Build complete!". Your new backend is now located in `backend/dist/backend`.*

### Step 2: Rebuild the React Frontend & Package with Electron
Whenever you change a React component (.jsx), CSS, or Electron script, you must run the build command again. This command compiles Vite into static HTML/JS, then grabs the backend built in Step 1, and wraps it all into the final `.exe`.

Open a second terminal and run:
```powershell
cd frontend
npm run electron:build
```
*Wait for this process to complete. It will generate the installer wrapper.*

### Step 3: Distribute
You will find your updated, ready-to-distribute setup application at:
`frontend/release/Battery Pack Designer Setup 1.0.0.exe` 

You can now send this file to your users to install the updated application!
