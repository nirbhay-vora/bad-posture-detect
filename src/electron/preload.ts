import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // React sends posture data every frame so main process can monitor even when hidden
  postureUpdate: (data: {
    percent: number
    deviationThreshold: number
    slouchSeconds: number
    cooldownSeconds: number
  }) => {
    ipcRenderer.send('posture-update', data)
  },
  notify: (title: string, body: string) => {
    ipcRenderer.send('show-notification', { title, body })
  }
})
