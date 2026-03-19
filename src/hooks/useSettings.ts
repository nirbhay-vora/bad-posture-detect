import { useState, useCallback } from 'react'

export interface Settings {
  deviationThreshold: number  // % deviation to consider bad posture (default 20)
  slouchSeconds: number       // seconds of bad posture before alert (default 10)
  cooldownSeconds: number     // seconds between alerts (default 10)
}

const DEFAULT_SETTINGS: Settings = {
  deviationThreshold: 20,
  slouchSeconds: 10,
  cooldownSeconds: 10,
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('ergovision-settings')
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  })

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem('ergovision-settings', JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, updateSettings }
}
