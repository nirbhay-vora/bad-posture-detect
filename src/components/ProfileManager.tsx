import { useState, useCallback } from 'react'
import type { PostureProfile } from '../hooks/useProfiles'
import type { Baseline } from '../hooks/usePostureEngine'

interface Props {
  profiles: PostureProfile[]
  activeProfileId: string | null
  currentBaseline: Baseline | null
  onSwitch: (id: string) => void
  onAdd: (name: string, baseline: Baseline) => void
  onDelete: (id: string) => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

export function ProfileManager({ profiles, activeProfileId, currentBaseline, onSwitch, onAdd, onDelete }: Props) {
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    if (!currentBaseline) {
      alert('Please calibrate your posture first (go to the Monitor tab and click Calibrate).')
      return
    }
    const name = newName.trim() || 'My Profile'
    setSaving(true)
    setTimeout(() => {
      onAdd(name, currentBaseline)
      setNewName('')
      setSaving(false)
    }, 300)
  }, [currentBaseline, newName, onAdd])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">🧑‍💻 Pose Profiles</h2>
        <span className="text-slate-500 text-xs">{profiles.length} saved</span>
      </div>

      {/* Profiles list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700/50">
        {profiles.length === 0 && (
          <div className="py-8 flex flex-col items-center text-slate-500 gap-2">
            <span className="text-2xl">🎯</span>
            <p className="text-sm">No profiles saved yet.</p>
            <p className="text-xs">Calibrate your posture above, then save below.</p>
          </div>
        )}
        {profiles.map(p => {
          const isActive = p.id === activeProfileId
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}
            >
              <div className={`w-3 h-3 rounded-full shrink-0 transition-all ${isActive ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${isActive ? 'text-blue-300' : 'text-white'}`}>{p.name}</p>
                <p className="text-slate-500 text-xs">Created {timeAgo(p.createdAt)}</p>
              </div>
              {isActive ? (
                <span className="text-blue-400 text-xs font-bold px-2 py-0.5 bg-blue-900/40 rounded-full">Active</span>
              ) : (
                <button
                  onClick={() => onSwitch(p.id)}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-700 hover:bg-blue-700 text-slate-300 hover:text-white transition-colors font-medium"
                >
                  Use
                </button>
              )}
              {deleteConfirm === p.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => { onDelete(p.id); setDeleteConfirm(null) }}
                    className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(p.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors text-sm px-1"
                  title="Delete profile"
                >
                  🗑
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Save new profile */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <p className="text-slate-300 text-sm font-semibold mb-3">💾 Save Current Calibration as Profile</p>
        {!currentBaseline && (
          <p className="text-amber-400 text-xs mb-3 flex items-center gap-1.5">
            ⚠ Calibrate first on the Monitor tab to save a profile.
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder='Profile name (e.g. "Standing Desk")'
            disabled={!currentBaseline}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSave}
            disabled={!currentBaseline || saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold transition-colors"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
