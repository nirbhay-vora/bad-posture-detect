import { useState, useCallback } from 'react'
import type { Baseline } from './usePostureEngine'

export interface PostureProfile {
  id: string
  name: string
  description?: string
  category?: string
  baseline: Baseline
  createdAt: number
  lastUsedAt?: number
  usageCount: number
  totalUsageTime: number // in seconds
  tags?: string[]
}

const PROFILES_KEY = 'ergovision-profiles'
const ACTIVE_KEY = 'ergovision-active-profile'
const BACKUP_KEY = 'ergovision-profiles-backup'
const MAX_PROFILES = 50
const MAX_NAME_LENGTH = 50

function loadProfiles(): PostureProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (!raw) return []
    
    const profiles = JSON.parse(raw)
    if (!Array.isArray(profiles)) return []
    
    // Validate and migrate old profile format
    return profiles.filter(p => {
      if (!p.id || !p.name || !p.baseline) return false
      // Migrate old profiles to new format
      if (p.usageCount === undefined) p.usageCount = 0
      if (p.totalUsageTime === undefined) p.totalUsageTime = 0
      if (p.lastUsedAt === undefined) p.lastUsedAt = p.createdAt
      return true
    })
  } catch (error) {
    console.error('Failed to load profiles:', error)
    // Attempt to restore from backup
    return restoreFromBackup()
  }
}

function restoreFromBackup(): PostureProfile[] {
  try {
    const backup = localStorage.getItem(BACKUP_KEY)
    if (backup) {
      const profiles = JSON.parse(backup)
      localStorage.setItem(PROFILES_KEY, backup)
      console.log('Restored profiles from backup')
      return profiles
    }
  } catch (error) {
    console.error('Failed to restore from backup:', error)
  }
  return []
}

function createBackup(profiles: PostureProfile[]) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(profiles))
  } catch (error) {
    console.error('Failed to create backup:', error)
  }
}

function saveProfiles(profiles: PostureProfile[]) {
  try {
    // Create backup before saving
    createBackup(profiles)
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
  } catch (error) {
    console.error('Failed to save profiles:', error)
    throw new Error('Failed to save profiles')
  }
}

function validateProfileName(name: string, profiles: PostureProfile[], excludeId?: string): string | null {
  const trimmed = name.trim()
  
  if (!trimmed) return 'Profile name cannot be empty'
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or less`
  
  const duplicate = profiles.find(p => p.name.toLowerCase() === trimmed.toLowerCase() && p.id !== excludeId)
  if (duplicate) return 'A profile with this name already exists'
  
  return null
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<PostureProfile[]>(loadProfiles)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  )

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null

  const addProfile = useCallback((name: string, baseline: Baseline, options?: { description?: string; category?: string; tags?: string[] }): { profile?: PostureProfile; error?: string } => {
    const validationError = validateProfileName(name, profiles)
    if (validationError) return { error: validationError }
    
    if (profiles.length >= MAX_PROFILES) {
      return { error: `Maximum ${MAX_PROFILES} profiles allowed` }
    }

    const profile: PostureProfile = {
      id: `profile-${Date.now()}`,
      name: name.trim(),
      description: options?.description,
      category: options?.category,
      baseline,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      usageCount: 0,
      totalUsageTime: 0,
      tags: options?.tags || [],
    }
    
    setProfiles(prev => {
      const next = [...prev, profile]
      saveProfiles(next)
      return next
    })
    
    // Make the new profile active immediately
    setActiveProfileId(profile.id)
    localStorage.setItem(ACTIVE_KEY, profile.id)
    
    return { profile }
  }, [profiles])

  const switchProfile = useCallback((id: string | null) => {
    setActiveProfileId(id)
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id)
      
      // Update profile usage statistics
      setProfiles(prev => {
        const updated = prev.map(p => {
          if (p.id === id) {
            return {
              ...p,
              lastUsedAt: Date.now(),
              usageCount: p.usageCount + 1
            }
          }
          return p
        })
        saveProfiles(updated)
        return updated
      })
      
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

  const renameProfile = useCallback((id: string, name: string): { error?: string } => {
    const validationError = validateProfileName(name, profiles, id)
    if (validationError) return { error: validationError }
    
    setProfiles(prev => {
      const next = prev.map(p => p.id === id ? { ...p, name: name.trim() } : p)
      saveProfiles(next)
      return next
    })
    
    return {}
  }, [profiles])

  const updateProfileUsage = useCallback((id: string, additionalTime: number) => {
    setProfiles(prev => {
      const next = prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            totalUsageTime: p.totalUsageTime + additionalTime
          }
        }
        return p
      })
      saveProfiles(next)
      return next
    })
  }, [])

  const updateProfileBaseline = useCallback((id: string, baseline: Baseline) => {
    setProfiles(prev => {
      const next = prev.map(p => p.id === id ? { ...p, baseline } : p)
      saveProfiles(next)
      return next
    })
    // Also keep ergovision-baseline in sync
    localStorage.setItem('ergovision-baseline', JSON.stringify(baseline))
  }, [])

  const updateProfileMetadata = useCallback((id: string, metadata: { description?: string; category?: string; tags?: string[] }) => {
    setProfiles(prev => {
      const next = prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            ...metadata
          }
        }
        return p
      })
      saveProfiles(next)
      return next
    })
  }, [])

  const exportProfiles = useCallback(() => {
    const data = {
      version: '1.0',
      exportedAt: Date.now(),
      profiles: profiles
    }
    return JSON.stringify(data, null, 2)
  }, [profiles])

  const importProfiles = useCallback((jsonData: string): { imported: number; errors: string[] } => {
    const errors: string[] = []
    let imported = 0
    
    try {
      const data = JSON.parse(jsonData)
      if (!data.profiles || !Array.isArray(data.profiles)) {
        errors.push('Invalid file format')
        return { imported, errors }
      }
      
      const currentProfiles = [...profiles]
      
      for (const profileData of data.profiles) {
        if (!profileData.name || !profileData.baseline) {
          errors.push(`Skipping invalid profile: ${profileData.name || 'Unknown'}`)
          continue
        }
        
        const validationError = validateProfileName(profileData.name, currentProfiles)
        if (validationError) {
          errors.push(`Skipping "${profileData.name}": ${validationError}`)
          continue
        }
        
        if (currentProfiles.length >= MAX_PROFILES) {
          errors.push('Maximum profiles reached, stopping import')
          break
        }
        
        const newProfile: PostureProfile = {
          id: `profile-${Date.now()}-${imported}`,
          name: profileData.name,
          description: profileData.description,
          category: profileData.category,
          baseline: profileData.baseline,
          createdAt: profileData.createdAt || Date.now(),
          lastUsedAt: profileData.lastUsedAt,
          usageCount: profileData.usageCount || 0,
          totalUsageTime: profileData.totalUsageTime || 0,
          tags: profileData.tags || []
        }
        
        currentProfiles.push(newProfile)
        imported++
      }
      
      if (imported > 0) {
        setProfiles(currentProfiles)
        saveProfiles(currentProfiles)
      }
      
    } catch (error) {
      errors.push('Failed to parse file')
    }
    
    return { imported, errors }
  }, [profiles])

  return {
    profiles,
    activeProfile,
    activeProfileId,
    addProfile,
    switchProfile,
    deleteProfile,
    renameProfile,
    updateProfileBaseline,
    updateProfileUsage,
    updateProfileMetadata,
    exportProfiles,
    importProfiles,
  }
}
