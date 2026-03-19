import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } from 'electron'
import { exec } from 'child_process'
import * as fs from 'fs'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'
const platform = process.platform

let isQuitting = false
let originalBrightness = 100

// ─── Posture State (updated by renderer via IPC) ──────────────────────────────
let lastPosturePercent = 0
let lastDeviationThreshold = 20
let lastSlouchSeconds = 10
let lastCooldownSeconds = 10

let slouchStartTime: number | null = null   // when continuous bad posture started
let cooldownUntil = 0                        // timestamp when cooldown expires
let isDimmed = false

// ─── Brightness ───────────────────────────────────────────────────────────────

function getLinuxBacklightPath(): string | null {
  try {
    const devices = fs.readdirSync('/sys/class/backlight/')
    return devices.length > 0 ? `/sys/class/backlight/${devices[0]}` : null
  } catch { return null }
}

function getCurrentBrightnessPercent(): number {
  try {
    if (platform === 'linux') {
      const p = getLinuxBacklightPath()
      if (!p) return 100
      const current = parseInt(fs.readFileSync(`${p}/brightness`, 'utf8').trim())
      const max = parseInt(fs.readFileSync(`${p}/max_brightness`, 'utf8').trim())
      return Math.round((current / max) * 100)
    }
    if (platform === 'darwin') {
      const out = require('child_process').execSync(`osascript -e 'tell application "System Events" to get brightness of screen 1'`).toString().trim()
      return Math.round(parseFloat(out) * 100)
    }
    if (platform === 'win32') {
      const out = require('child_process').execSync(`powershell -command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"`).toString().trim()
      return parseInt(out)
    }
  } catch (e) { console.error('❌ get brightness:', e) }
  return 100
}

function setBrightnessPercent(percent: number) {
  try {
    if (platform === 'linux') {
      const p = getLinuxBacklightPath()
      if (!p) return
      const max = parseInt(fs.readFileSync(`${p}/max_brightness`, 'utf8').trim())
      const value = Math.floor((percent / 100) * max)
      try { fs.writeFileSync(`${p}/brightness`, String(value)) }
      catch { exec(`echo ${value} | sudo tee ${p}/brightness`, (err) => { if (err) console.error('❌ brightness linux:', err.message) }) }
    } else if (platform === 'darwin') {
      exec(`osascript -e 'tell application "System Events" to set brightness of screen 1 to ${(percent / 100).toFixed(2)}'`, (err) => { if (err) console.error('❌ brightness macOS:', err.message) })
    } else if (platform === 'win32') {
      exec(`powershell -command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${percent})"`, (err) => { if (err) console.error('❌ brightness win32:', err.message) })
    }
  } catch (e) { console.error('❌ setBrightness:', e) }
}

function dimScreen() {
  if (isDimmed) return
  originalBrightness = getCurrentBrightnessPercent()
  setBrightnessPercent(20)
  isDimmed = true
  console.log(`🔅 Dimmed: ${originalBrightness}% → 20%`)
}

function restoreBrightness() {
  if (!isDimmed) return
  setBrightnessPercent(originalBrightness)
  isDimmed = false
  console.log(`🔆 Restored: ${originalBrightness}%`)
}

function sendNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body, urgency: 'normal' }).show()
  } else {
    exec(`notify-send "${title}" "${body}"`, (err) => {
      if (err) console.error('❌ notify-send:', err.message)
    })
  }
}

// ─── Main Process Posture Monitor Loop ───────────────────────────────────────
// Runs every 100ms regardless of window visibility

function startPostureMonitor() {
  setInterval(() => {
    const now = Date.now()
    const isBad = lastPosturePercent > lastDeviationThreshold

    if (isBad) {
      if (slouchStartTime === null) slouchStartTime = now
      const slouchDuration = now - slouchStartTime

      if (slouchDuration >= lastSlouchSeconds * 1000 && cooldownUntil < now) {
        console.warn('🚨 Main process: bad posture alert!')
        dimScreen()
        sendNotification('🧍 ErgoVision Alert', "You've been slouching! Sit up straight!")
        cooldownUntil = now + lastCooldownSeconds * 1000
        slouchStartTime = now // reset so it can fire again after cooldown
      }
    } else {
      slouchStartTime = null
      restoreBrightness()
    }
  }, 100)
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

let tray: Tray | null = null

function createTray(win: BrowserWindow) {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('ErgoVision — Posture Guardian')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show ErgoVision', click: () => { win.show(); win.focus() } },
    {
      label: 'Quit', click: () => {
        isQuitting = true
        restoreBrightness()
        app.quit()
      }
    }
  ]))
  tray.on('click', () => { win.show(); win.focus() })
}

// ─── Window ───────────────────────────────────────────────────────────────────

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

  // Prevent Chromium from throttling JS/RAF when window is hidden
  win.webContents.setBackgroundThrottling(false)

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.webContents.on('did-finish-load', () => console.log('✅ Window loaded'))
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error('❌ Load failed:', code, desc))
  return win
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// React sends posture data every frame — main process uses this for monitoring
ipcMain.on('posture-update', (_event, data: {
  percent: number
  deviationThreshold: number
  slouchSeconds: number
  cooldownSeconds: number
}) => {
  lastPosturePercent = data.percent
  lastDeviationThreshold = data.deviationThreshold
  lastSlouchSeconds = data.slouchSeconds
  lastCooldownSeconds = data.cooldownSeconds
})

ipcMain.on('show-notification', (_event, { title, body }: { title: string; body: string }) => {
  sendNotification(title, body)
})

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setName('ErgoVision')
  console.log(`🚀 Electron ready on ${platform}`)
  const win = createWindow()
  createTray(win)
  startPostureMonitor()
})

app.on('window-all-closed', () => {
  // keep running in tray
})

app.on('before-quit', () => {
  isQuitting = true
})
