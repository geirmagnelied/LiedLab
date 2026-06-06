const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

let win = null
let tray = null
let isQuitting = false

// ── Autostart ──────────────────────────────────────────────────────────────
function setAutostart(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    name: 'Notatapp',
    args: ['--autostart'],
  })
}

function getAutostart() {
  return app.getLoginItemSettings().openAtLogin
}

// ── Tray icon (inline PNG as base64 so no external file needed) ────────────
function createTrayIcon() {
  // Simple "N" icon as a 16x16 PNG drawn via nativeImage
  // We'll use a canvas-like approach with a small PNG file if it exists,
  // otherwise fall back to a plain icon
  const iconPath = path.join(__dirname, 'icon.png')
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath)
  }
  // Fallback: create a simple colored square image
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFASURBVDiNpZMxSgNBFIa/2d1kFRQEsbCwtrCwEGwEsfMAvIGHsPQA3sHWwlOwFBGxFGwsLATBwlJQCCIiKAiKSlAJms3ujsVmN5vNRhB84M/wZt6b92bmPWOMYY2MMYiIqCqq2vNWVUSkp3tYVe2pqjUhhACwCoCITAGMMeScQc4BkDMHQBvgADCdA4CI3AFXgCTJkiRJkmRJkiSQJCm1AVJK6QFIKf0AkCQ5gCRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJACRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAD//wAA//8AAAA='
  )
}

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    title: 'Notatapp',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  })

  // Load the built Vite app
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
  win.loadFile(indexPath)

  win.once('ready-to-show', () => {
    // Don't show on autostart — stay in tray
    if (!process.argv.includes('--autostart')) {
      win.show()
    }
  })

  // Hide to tray instead of closing
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.on('closed', () => { win = null })
}

// ── Tray ────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('Notatapp')

  const updateMenu = () => {
    const autostartEnabled = getAutostart()
    const menu = Menu.buildFromTemplate([
      {
        label: 'Opne Notatapp',
        click: showWindow,
      },
      { type: 'separator' },
      {
        label: 'Start med Windows',
        type: 'checkbox',
        checked: autostartEnabled,
        click: (item) => {
          setAutostart(item.checked)
          updateMenu()
        },
      },
      { type: 'separator' },
      {
        label: 'Avslutt',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])
    tray.setContextMenu(menu)
  }

  updateMenu()

  // Single click = show/hide
  tray.on('click', () => {
    if (win && win.isVisible()) {
      win.hide()
    } else {
      showWindow()
    }
  })
}

function showWindow() {
  if (!win) createWindow()
  win.show()
  win.focus()
  if (win.isMinimized()) win.restore()
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()

  // Enable autostart by default on first run
  if (!getAutostart()) {
    setAutostart(true)
  }
})

app.on('second-instance', () => {
  showWindow()
})

app.on('window-all-closed', (e) => {
  // Keep app alive in tray — don't quit
  e.preventDefault()
})

app.on('before-quit', () => {
  isQuitting = true
})
