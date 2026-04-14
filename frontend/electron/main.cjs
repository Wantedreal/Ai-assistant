/**
 * Electron Main Process
 * Spawns FastAPI backend, polls for health, and loads React frontend
 */

const { app, BrowserWindow, Menu, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const http = require('http')
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('use-angle', 'gl');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

// Simple isDev check - if app is in unpacked directory it's dev mode
const isDev = process.env.ELECTRON_DEV === 'true' || process.argv.some(arg => arg === '--dev')

// Global backend process reference
let backendProcess = null
let mainWindow = null
let backendLastOutput = ''  // capture last lines for error reporting

const BACKEND_PORT = 8000
// Use 127.0.0.1 explicitly — on Windows, Node.js may resolve "localhost" to ::1
// (IPv6) while uvicorn only binds 0.0.0.0 (IPv4), causing connection refused.
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/v1/health`
const HEALTH_CHECK_INTERVAL = 1000 // ms
const HEALTH_CHECK_MAX_ATTEMPTS = 30 // ~30 seconds timeout

/**
 * Determine the path to the FastAPI backend binary
 * In production: bundled next to the Electron executable
 * In dev: assume it's running in terminal
 */
function getBackendBinaryPath() {
  if (isDev) {
    // Development: assume backend is running separately
    return null
  }
  
  // electron-builder places extraResources in process.resourcesPath
  const binDir = path.join(process.resourcesPath, 'backend')
  const platform = process.platform
  
  let binaryName = 'backend'
  if (platform === 'win32') binaryName += '.exe'
  
  return path.join(binDir, binaryName)
}

/**
 * Spawn the FastAPI backend process
 * Returns Promise<void> that resolves when backend is healthy
 */
async function startBackend() {
  const binaryPath = getBackendBinaryPath()
  
  if (!binaryPath || isDev) {
    console.log('[Backend] Development mode - assuming backend is running elsewhere')
    return
  }
  
  if (!require('fs').existsSync(binaryPath)) {
    throw new Error(`Backend binary not found at ${binaryPath}`)
  }
  
  // Log file in %APPDATA%\Battery Pack Designer\backend.log — survives crashes
  const logDir = path.join(app.getPath('userData'), '..')
  const logFile = path.join(logDir, 'backend.log')
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })
  const logLine = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`
    console.log(line)
    logStream.write(line + '\n')
    backendLastOutput = (backendLastOutput + '\n' + line).slice(-2000)
  }

  logLine(`Spawning backend: ${binaryPath}`)
  logLine(`CWD: ${path.dirname(binaryPath)}`)
  logLine(`Exists: ${fs.existsSync(binaryPath)}`)
  logLine(`_internal exists: ${fs.existsSync(path.join(path.dirname(binaryPath), '_internal'))}`)

  backendProcess = spawn(binaryPath, [], {
    detached: false,
    stdio: 'pipe',
    cwd: path.dirname(binaryPath),  // run from its own dir so _internal/ is found
  })

  backendProcess.stdout?.on('data', (data) => {
    logLine(`[stdout] ${data.toString().trim()}`)
  })

  backendProcess.stderr?.on('data', (data) => {
    logLine(`[stderr] ${data.toString().trim()}`)
  })

  backendProcess.on('error', (err) => {
    logLine(`[spawn error] ${err.message}`)
  })

  backendProcess.on('exit', (code, signal) => {
    logLine(`[exit] code=${code} signal=${signal}`)
    backendProcess = null
  })
  
  // Wait for health check
  await waitForBackendHealth()
}

/**
 * Poll the health endpoint until it returns 200
 */
async function waitForBackendHealth() {
  let attempts = 0
  
  while (attempts < HEALTH_CHECK_MAX_ATTEMPTS) {
    try {
      const response = await new Promise((resolve, reject) => {
        http.get(BACKEND_HEALTH_URL, (res) => {
          if (res.statusCode === 200) {
            resolve(true)
          } else {
            reject(new Error(`Health check returned ${res.statusCode}`))
          }
        })
        .on('error', reject)
        .setTimeout(1000, () => reject(new Error('Timeout')))
      })
      
      console.log('[Backend] Health check passed ✓')
      return
    } catch (error) {
      attempts++
      console.log(`[Backend] Health check attempt ${attempts}/${HEALTH_CHECK_MAX_ATTEMPTS}...`)
      
      if (attempts >= HEALTH_CHECK_MAX_ATTEMPTS) {
        throw new Error(
          `Backend health check failed after ${HEALTH_CHECK_MAX_ATTEMPTS} attempts.\n\n` +
          `Backend output:\n${backendLastOutput.trim() || '(no output — process may have crashed immediately)'}`
        )
      }
      
      await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
    }
  }
}

/**
 * Create the main application window
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,   // hidden until content is ready
    backgroundColor: '#1a1c23',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  })

  // Show a loading screen instantly while the backend warms up
  if (!isDev) {
    mainWindow.loadURL(`data:text/html,
      <html><body style="margin:0;background:#1a1c23;display:flex;align-items:center;
        justify-content:center;height:100vh;font-family:sans-serif;color:#93c5fd;">
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:600;margin-bottom:12px">Battery Pack Designer</div>
          <div style="font-size:13px;opacity:0.6">Starting backend, please wait…</div>
        </div>
      </body></html>`)
    mainWindow.show()
  }

  const startURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  console.log(`[Electron] Loading: ${startURL}`)

  if (isDev) {
    await mainWindow.loadURL(startURL)
    mainWindow.webContents.openDevTools()
    mainWindow.show()
  } else {
    // Wait for backend then swap to the real app
    await startBackend()
    await mainWindow.loadURL(startURL)
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

/**
 * App lifecycle events
 */
app.on('ready', async () => {
  try {
    await createWindow()
  } catch (error) {
    console.error('[Electron] Startup error:', error)
    dialog.showErrorBox(
      'Battery Pack Designer — Startup Error',
      `Failed to start the application:\n\n${error.message}\n\nPlease reinstall the application.`
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // On macOS, keep the app running until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // Re-create window when dock icon is clicked on macOS
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', (event) => {
  // Kill backend process before quitting
  if (backendProcess) {
    console.log('[Backend] Terminating process...')
    backendProcess.kill('SIGTERM')
    
    // Force kill after timeout
    setTimeout(() => {
      if (backendProcess) {
        backendProcess.kill('SIGKILL')
      }
    }, 5000)
  }
})

/**
 * Create application menu
 */
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
  ]
  
  if (isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        { label: 'DevTools', accelerator: 'F12', role: 'toggleDevTools' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      ],
    })
  }
  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(createMenu)
