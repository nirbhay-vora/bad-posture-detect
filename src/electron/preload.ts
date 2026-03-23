import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  notify: (title: string, body: string) => {
    ipcRenderer.send('show-notification', { title, body })
  },
  postureUpdate: (data: {
    percent: number
    deviationThreshold: number
    slouchSeconds: number
    cooldownSeconds: number
    feedback?: string
  }) => {
    ipcRenderer.send('posture-update', data)
  },
  dimScreen: () => {
    ipcRenderer.send('dim-screen')
  },
  restoreBrightness: () => {
    ipcRenderer.send('restore-brightness')
  }
})
