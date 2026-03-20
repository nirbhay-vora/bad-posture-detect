import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { exec } from 'child_process'
import * as fs from 'fs'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'
const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'
const isMac = process.platform === 'darwin'

// ── Brightness (Linux) ──────────────────────────────────────────────────────
const BACKLIGHT_PATH = '/sys/class/backlight/intel_backlight/brightness'
const MAX_BRIGHTNESS = 24242
let originalBrightness = 12242
let originalWindowsBrightness = 100

function getCurrentBrightness(): number {
  try {
    return parseInt(fs.readFileSync(BACKLIGHT_PATH, 'utf8').trim())
  } catch {
    return MAX_BRIGHTNESS
  }
}

function setBrightness(value: number) {
  try {
    fs.writeFileSync(BACKLIGHT_PATH, String(value))
  } catch {
    exec(`echo ${value} | sudo tee ${BACKLIGHT_PATH}`, (err) => {
      if (err) console.error('❌ Failed to set brightness:', err.message)
    })
  }
}

// ── Brightness (Windows via PowerShell WMI) ─────────────────────────────────
function getWindowsBrightness(): Promise<number> {
  return new Promise((resolve) => {
    exec(
      `powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"`,
      (err, stdout) => {
        if (err) { resolve(100); return }
        resolve(parseInt(stdout.trim()) || 100)
      }
    )
  })
}

function setWindowsBrightness(value: number) {
  exec(
    `powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${value})"`,
    (err) => { if (err) console.error('❌ Windows brightness failed:', err.message) }
  )
}

// ── Brightness (macOS via brightness CLI) ───────────────────────────────────
let originalMacBrightness = 1.0

function getMacBrightness(): Promise<number> {
  return new Promise((resolve) => {
    exec('brightness -l 2>&1', (err, stdout) => {
      if (err) { resolve(1.0); return }
      const match = stdout.match(/display 0: brightness ([0-9.]+)/)
      resolve(match ? parseFloat(match[1]) : 1.0)
    })
  })
}

function setMacBrightness(value: number) {
  exec(`brightness ${value.toFixed(2)}`, (err) => {
    if (err) console.warn('⚠️ macOS: install brightness CLI via: brew install brightness')
  })
}

async function dimScreen() {
  if (isWindows) {
    originalWindowsBrightness = await getWindowsBrightness()
    setWindowsBrightness(20)
    console.log(`🔅 Windows: dimmed to 20% (was ${originalWindowsBrightness}%)`)
  } else if (isLinux) {
    originalBrightness = getCurrentBrightness()
    const dimValue = Math.floor(MAX_BRIGHTNESS * 0.2)
    setBrightness(dimValue)
    console.log(`🔅 Linux: dimmed ${originalBrightness} → ${dimValue}`)
  } else if (isMac) {
    originalMacBrightness = await getMacBrightness()
    setMacBrightness(0.2)
    console.log(`🔅 macOS: dimmed to 0.2 (was ${originalMacBrightness})`)
  }
}

function restoreBrightness() {
  if (isWindows) {
    setWindowsBrightness(originalWindowsBrightness)
    console.log(`🔆 Windows: restored to ${originalWindowsBrightness}%`)
  } else if (isLinux) {
    setBrightness(originalBrightness)
    console.log(`🔆 Linux: restored to ${originalBrightness}`)
  } else if (isMac) {
    setMacBrightness(originalMacBrightness)
    console.log(`🔆 macOS: restored to ${originalMacBrightness}`)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'ErgoVision',
    show: false, // don't steal focus from other apps on launch
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep detection running when minimized/hidden
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.once('did-finish-load', () => {
    win.showInactive() // show without stealing focus
    console.log('✅ Window loaded successfully')
  })
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error('❌ Window failed to load:', code, desc))
}

ipcMain.on('dim-screen', () => { dimScreen() })
ipcMain.on('restore-brightness', () => restoreBrightness())

ipcMain.on('show-notification', (_event, { title, body }: { title: string; body: string }) => {
  console.log('📣 Notification requested:', title, body)

  if (Notification.isSupported()) {
    const notifOptions: Electron.NotificationConstructorOptions = { title, body }
    // urgency is Linux-only; omit on Windows to avoid silent failure
    if (isLinux) (notifOptions as any).urgency = 'normal'
    const notif = new Notification(notifOptions)
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
