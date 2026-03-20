import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  notify: (title: string, body: string) => {
    ipcRenderer.send('show-notification', { title, body })
  },
  dimScreen: () => {
    ipcRenderer.send('dim-screen')
  },
  restoreBrightness: () => {
    ipcRenderer.send('restore-brightness')
  }
})
