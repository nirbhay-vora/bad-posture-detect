export {}

declare global {
  interface Window {
    electronAPI: {
      notify: (title: string, body: string) => void
      focusWindow: () => void
      dimScreen: () => void
      restoreBrightness: () => void
    }
  }
}
