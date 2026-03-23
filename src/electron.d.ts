export {}

declare global {
  interface Window {
    electronAPI?: {
      postureUpdate: (data: {
        percent: number
        deviationThreshold: number
        slouchSeconds: number
        cooldownSeconds: number
        feedback?: string
      }) => void
      notify: (title: string, body: string) => void
      dimScreen: () => void
      restoreBrightness: () => void
    }
  }
}
