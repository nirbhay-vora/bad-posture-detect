import { useState, useCallback } from 'react'
import type { Baseline } from './usePostureEngine'

export interface PostureProfile {
  id: string
  name: string
  baseline: Baseline
  createdAt: number
}

const PROFILES_KEY = 'ergovision-profiles'
const ACTIVE_KEY = 'ergovision-active-profile'

function loadProfiles(): PostureProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveProfiles(profiles: PostureProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<PostureProfile[]>(loadProfiles)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  )

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null

  const addProfile = useCallback((name: string, baseline: Baseline): PostureProfile => {
    const profile: PostureProfile = {
      id: `profile-${Date.now()}`,
      name: name.trim() || 'My Profile',
      baseline,
      createdAt: Date.now(),
    }
    setProfiles(prev => {
      const next = [...prev, profile]
      saveProfiles(next)
      return next
    })
    // Make the new profile active immediately
    setActiveProfileId(profile.id)
    localStorage.setItem(ACTIVE_KEY, profile.id)
    return profile
  }, [])

  const switchProfile = useCallback((id: string | null) => {
    setActiveProfileId(id)
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id)
      // Also sync this profile's baseline immediately so ergovision-baseline
      // is always in lockstep with the active profile
      const allProfiles: PostureProfile[] = JSON.parse(
        localStorage.getItem(PROFILES_KEY) ?? '[]'
      )
      const profile = allProfiles.find(p => p.id === id)
      if (profile) {
        localStorage.setItem('ergovision-baseline', JSON.stringify(profile.baseline))
      }
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  }, [])

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id)
      saveProfiles(next)
      return next
    })
    setActiveProfileId(prev => {
      if (prev === id) {
        const remaining = profiles.filter(p => p.id !== id)
        const nextId = remaining.length > 0 ? remaining[remaining.length - 1].id : null
        if (nextId) localStorage.setItem(ACTIVE_KEY, nextId)
        else localStorage.removeItem(ACTIVE_KEY)
        return nextId
      }
      return prev
    })
  }, [profiles])

  const renameProfile = useCallback((id: string, name: string) => {
    setProfiles(prev => {
      const next = prev.map(p => p.id === id ? { ...p, name } : p)
      saveProfiles(next)
      return next
    })
  }, [])

  return {
    profiles,
    activeProfile,
    activeProfileId,
    addProfile,
    switchProfile,
    deleteProfile,
    renameProfile,
  }
}
