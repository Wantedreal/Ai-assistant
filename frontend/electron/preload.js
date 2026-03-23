/**
 * Preload Script for Electron
 * Securely exposes limited APIs to the renderer process
 */

const { contextBridge, ipcMain, ipcRenderer } = require('electron')

// Expose safe APIs to React frontend
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,
  arch: process.arch,
  
  // IPC communication (if needed in future)
  send: (channel, ...args) => {
    // Whitelist safe channels only
    const validChannels = ['app-version', 'log']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  
  on: (channel, listener) => {
    const validChannels = ['backend-status']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => listener(...args))
    }
  },
})
