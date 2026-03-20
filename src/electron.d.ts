export {}

declare global {
  interface Window {
    electronAPI: {
      notify: (title: string, body: string) => void
      dimScreen: () => void
      restoreBrightness: () => void
    }
  }
}
