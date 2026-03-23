import { useState, useCallback } from 'react'

export interface PostureSession {
  id: string
  date: string        // ISO date string e.g. "2025-01-15"
  hour: number        // 0-23 (starting hour of this session)
  timestamp: number   // Unix ms
  goodSeconds: number
  badSeconds: number
  alertCount: number
}

const STORAGE_KEY = 'ergovision-history'
const MAX_SESSIONS = 500 // cap to avoid unbounded localStorage growth

function loadSessions(): PostureSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: PostureSession[]) {
  try {
    // Keep only the most recent MAX_SESSIONS
    const trimmed = sessions.slice(-MAX_SESSIONS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    console.error('Failed to save posture history')
  }
}

export interface BadPostureEvent {
  timestamp: number
  date: string
  hour: number
}

const EVENTS_KEY = 'ergovision-bad-events'

function loadEvents(): BadPostureEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEvents(events: BadPostureEvent[]) {
  try {
    const trimmed = events.slice(-5000)
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed))
  } catch {
    console.error('Failed to save bad posture events')
  }
}

export function usePostureHistory() {
  const [sessions, setSessions] = useState<PostureSession[]>(loadSessions)
  const [badEvents, setBadEvents] = useState<BadPostureEvent[]>(loadEvents)

  const addSession = useCallback((stats: {
    goodSeconds: number
    badSeconds: number
    alertCount: number
  }) => {
    if (stats.goodSeconds + stats.badSeconds < 5) return // skip trivial sessions

    const now = new Date()
    const session: PostureSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: now.toISOString().split('T')[0],
      hour: now.getHours(),
      timestamp: Date.now(),
      goodSeconds: stats.goodSeconds,
      badSeconds: stats.badSeconds,
      alertCount: stats.alertCount,
    }

    setSessions(prev => {
      const next = [...prev, session]
      saveSessions(next)
      return next
    })
  }, [])

  const logBadPostureEvent = useCallback(() => {
    const now = new Date()
    const event: BadPostureEvent = {
      timestamp: Date.now(),
      date: now.toISOString().split('T')[0],
      hour: now.getHours(),
    }
    setBadEvents(prev => {
      const next = [...prev, event]
      saveEvents(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setSessions([])
    setBadEvents([])
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(EVENTS_KEY)
  }, [])

  // ─── Derived: worst hour of day ──────────────────────────────────────────────
  const worstHour = (() => {
    if (sessions.length === 0) return null
    const badByHour: Record<number, number> = {}
    const totalByHour: Record<number, number> = {}
    for (const s of sessions) {
      const h = s.hour
      badByHour[h] = (badByHour[h] ?? 0) + s.badSeconds
      totalByHour[h] = (totalByHour[h] ?? 0) + s.goodSeconds + s.badSeconds
    }
    let worst = -1
    let worstRatio = -1
    for (const h of Object.keys(badByHour).map(Number)) {
      const ratio = badByHour[h] / (totalByHour[h] || 1)
      if (ratio > worstRatio) {
        worstRatio = ratio
        worst = h
      }
    }
    if (worst === -1) return null
    const endH = (worst + 1) % 24
    const fmt = (h: number) => {
      const ampm = h < 12 ? 'AM' : 'PM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      return `${h12} ${ampm}`
    }
    return { hour: worst, label: `${fmt(worst)}–${fmt(endH)}`, ratio: worstRatio }
  })()

  return {
    sessions,
    badEvents,
    addSession,
    logBadPostureEvent,
    clearHistory,
    worstHour,
  }
}
