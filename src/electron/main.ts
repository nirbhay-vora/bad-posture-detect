import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { exec, execSync } from 'child_process'
import * as fs from 'fs'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

const BACKLIGHT_PATH = '/sys/class/backlight/intel_backlight/brightness'
const MAX_BRIGHTNESS = 24242
let originalBrightness = 12242

function getCurrentBrightness(): number {
  try {
    return parseInt(fs.readFileSync(BACKLIGHT_PATH, 'utf8').trim())
  } catch {
    return MAX_BRIGHTNESS
  }
}

function setBrightness(value: number) {
  try {
    // Try direct write first (works if user has write permission)
    fs.writeFileSync(BACKLIGHT_PATH, String(value))
  } catch {
    // Fallback: use sudo tee (passwordless via /etc/sudoers.d/ergovision-backlight)
    exec(`echo ${value} | sudo tee ${BACKLIGHT_PATH}`, (err) => {
      if (err) console.error('❌ Failed to set brightness:', err.message)
    })
  }
}

function dimScreen() {
  originalBrightness = getCurrentBrightness()
  const dimValue = Math.floor(MAX_BRIGHTNESS * 0.2) // dim to 20%
  setBrightness(dimValue)
  console.log(`🔅 Dimmed brightness: ${originalBrightness} → ${dimValue}`)
}

function restoreBrightness() {
  setBrightness(originalBrightness)
  console.log(`🔆 Restored brightness to ${originalBrightness}`)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'ErgoVision',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.on('did-finish-load', () => console.log('✅ Window loaded successfully'))
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error('❌ Window failed to load:', code, desc))
}

ipcMain.on('focus-window', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    win.setAlwaysOnTop(true)
    win.show()
    win.focus()
    win.setAlwaysOnTop(false)
  }
})

ipcMain.on('dim-screen', () => dimScreen())
ipcMain.on('restore-brightness', () => restoreBrightness())

ipcMain.on('show-notification', (_event, { title, body }: { title: string; body: string }) => {
  console.log('📣 Notification requested:', title, body)

  if (Notification.isSupported()) {
    const notif = new Notification({ title, body, urgency: 'normal' })
    notif.on('show', () => console.log('✅ Notification shown'))
    notif.on('failed', (e) => console.error('❌ Notification failed:', e))
    notif.show()
  } else {
    exec(`notify-send "${title}" "${body}"`, (err) => {
      if (err) {
        console.warn('⚠️ notify-send failed, sending in-app fallback')
        BrowserWindow.getAllWindows()[0]?.webContents.send('fallback-alert', { title, body })
      } else {
        console.log('✅ notify-send succeeded')
      }
    })
  }
})

app.whenReady().then(() => {
  app.setName('ErgoVision')
  console.log('🚀 Electron app ready')
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
