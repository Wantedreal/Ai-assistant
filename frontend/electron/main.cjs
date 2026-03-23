/**
 * Electron Main Process
 * Spawns FastAPI backend, polls for health, and loads React frontend
 */

const { app, BrowserWindow, Menu, dialog } = require('electron')
const path = require('path')
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

const BACKEND_PORT = 8000
const BACKEND_HEALTH_URL = `http://localhost:${BACKEND_PORT}/api/v1/health`
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
  
  console.log(`[Backend] Spawning: ${binaryPath}`)
  
  backendProcess = spawn(binaryPath, [], {
    detached: false,
    stdio: 'pipe',
  })
  
  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Backend stdout] ${data.toString().trim()}`)
  })
  
  backendProcess.stderr?.on('data', (data) => {
    console.log(`[Backend stderr] ${data.toString().trim()}`)
  })
  
  backendProcess.on('error', (err) => {
    console.error('[Backend] Error:', err)
  })
  
  backendProcess.on('exit', (code, signal) => {
    console.log(`[Backend] Exited with code ${code}, signal ${signal}`)
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
        throw new Error(`Backend health check failed after ${HEALTH_CHECK_MAX_ATTEMPTS} attempts`)
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  })
  
  const startURL = isDev
    ? 'http://localhost:5173' // Vite dev server
    : `file://${path.join(__dirname, '../dist/index.html')}` // Production build
  
  console.log(`[Electron] Loading: ${startURL}`)
  await mainWindow.loadURL(startURL)
  
  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * App lifecycle events
 */
app.on('ready', async () => {
  try {
    await startBackend()
    await createWindow()
  } catch (error) {
    console.error('[Electron] Startup error:', error)
    dialog.showErrorBox(
      'Battery Pack Assistant - Startup Error',
      `Failed to start application:\n\n${error.message}`
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
