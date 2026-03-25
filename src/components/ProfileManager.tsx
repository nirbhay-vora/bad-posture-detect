import { useState, useCallback, useMemo } from 'react'
import type { PostureProfile } from '../hooks/useProfiles'
import type { Baseline } from '../hooks/usePostureEngine'
import { Search, Download, Upload, Tag, Edit2, X, Plus, Filter, ChevronDown, Clock, TrendingUp } from 'lucide-react'

interface Props {
  profiles: PostureProfile[]
  activeProfileId: string | null
  currentBaseline: Baseline | null
  onSwitch: (id: string) => void
  onAdd: (name: string, baseline: Baseline, options?: { description?: string; category?: string; tags?: string[] }) => { profile?: PostureProfile; error?: string }
  onDelete: (id: string) => void
  onUpdateMetadata: (id: string, metadata: { description?: string; category?: string; tags?: string[] }) => void
  onRename: (id: string, name: string) => { error?: string }
  onExport: () => string
  onImport: (data: string) => { imported: number; errors: string[] }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const CATEGORIES = ['Work', 'Home', 'Ergonomic', 'Standing Desk', 'Laptop', 'Monitor Setup', 'Other']
const COMMON_TAGS = ['neck-pain', 'back-pain', 'shoulder-pain', 'eye-strain', 'focus', 'breaks']

export function ProfileManager({ profiles, activeProfileId, currentBaseline, onSwitch, onAdd, onDelete, onUpdateMetadata, onRename, onExport, onImport }: Props) {
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newTags, setNewTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editingProfile, setEditingProfile] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)

  const filteredProfiles = useMemo(() => {
    let filtered = profiles
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }
    
    return filtered.sort((a, b) => {
      // Sort by last used, then by usage count
      const aLastUsed = a.lastUsedAt || a.createdAt
      const bLastUsed = b.lastUsedAt || b.createdAt
      if (aLastUsed !== bLastUsed) {
        return bLastUsed - aLastUsed
      }
      return b.usageCount - a.usageCount
    })
  }, [profiles, searchQuery, selectedCategory])

  const handleSave = useCallback(() => {
    if (!currentBaseline) {
      alert('Please calibrate your posture first (go to the Monitor tab and click Calibrate).')
      return
    }
    
    const tags = newTags.split(',').map(t => t.trim()).filter(t => t)
    const result = onAdd(newName.trim() || 'My Profile', currentBaseline, {
      description: newDescription.trim() || undefined,
      category: newCategory || undefined,
      tags: tags.length > 0 ? tags : undefined
    })
    
    if (result.error) {
      alert(result.error)
      return
    }
    
    setSaving(true)
    setTimeout(() => {
      setNewName('')
      setNewDescription('')
      setNewCategory('')
      setNewTags('')
      setSaving(false)
    }, 300)
  }, [currentBaseline, newName, newDescription, newCategory, newTags, onAdd])

  const handleExport = useCallback(() => {
    const data = onExport()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ergovision-profiles-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [onExport])

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = onImport(content)
      setImportErrors(result.errors)
      if (result.imported > 0) {
        setShowImportModal(false)
        alert(`Successfully imported ${result.imported} profile${result.imported > 1 ? 's' : ''}`)
      }
    }
    reader.readAsText(file)
    event.target.value = '' // Reset input
  }, [onImport])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">🧑‍💻 Pose Profiles</h2>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-xs">{profiles.length} saved</span>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      {showAdvanced && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search profiles..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-blue-700 text-slate-300 hover:text-white transition-colors text-sm"
            >
              <Download size={14} />
              Export
            </button>
            
            <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-green-700 text-slate-300 hover:text-white transition-colors text-sm cursor-pointer">
              <Upload size={14} />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Profiles list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700/50">
        {filteredProfiles.length === 0 && (
          <div className="py-8 flex flex-col items-center text-slate-500 gap-2">
            <span className="text-2xl">🎯</span>
            <p className="text-sm">
              {searchQuery || selectedCategory !== 'all' ? 'No profiles match your filters.' : 'No profiles saved yet.'}
            </p>
            <p className="text-xs">
              {searchQuery || selectedCategory !== 'all' ? 'Try adjusting your search or filters.' : 'Calibrate your posture above, then save below.'}
            </p>
          </div>
        )}
        {filteredProfiles.map(p => {
          const isActive = p.id === activeProfileId
          return (
            <div
              key={p.id}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${isActive ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}
            >
              <div className={`w-3 h-3 rounded-full shrink-0 transition-all mt-1 ${isActive ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`font-semibold text-sm truncate ${isActive ? 'text-blue-300' : 'text-white'}`}>{p.name}</p>
                  {p.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      {p.category}
                    </span>
                  )}
                </div>
                
                {p.description && (
                  <p className="text-slate-400 text-xs mb-2 line-clamp-2">{p.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Created {timeAgo(p.createdAt)}
                  </span>
                  {p.usageCount > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} />
                      Used {p.usageCount}x
                    </span>
                  )}
                  {p.totalUsageTime > 0 && (
                    <span>Total {formatDuration(p.totalUsageTime)}</span>
                  )}
                </div>
                
                {p.tags && p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {isActive ? (
                  <span className="text-blue-400 text-xs font-bold px-2 py-1 bg-blue-900/40 rounded-full">Active</span>
                ) : (
                  <button
                    onClick={() => onSwitch(p.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-slate-700 hover:bg-blue-700 text-slate-300 hover:text-white transition-colors font-medium"
                  >
                    Use
                  </button>
                )}
                
                {editingProfile === p.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingProfile(null)}
                      className="text-slate-600 hover:text-slate-400 transition-colors text-sm px-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setEditingProfile(p.id)}
                      className="text-slate-600 hover:text-blue-400 transition-colors text-sm px-1"
                      title="Edit profile"
                    >
                      <Edit2 size={14} />
                    </button>
                    
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
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Save new profile */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-300 text-sm font-semibold">💾 Save Current Calibration as Profile</p>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            {showAdvanced ? 'Simple' : 'Advanced'}
          </button>
        </div>
        
        {!currentBaseline && (
          <p className="text-amber-400 text-xs mb-3 flex items-center gap-1.5">
            ⚠ Calibrate first on the Monitor tab to save a profile.
          </p>
        )}
        
        <div className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder='Profile name (e.g. "Standing Desk")'
            disabled={!currentBaseline}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          
          {showAdvanced && (
            <>
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Optional description..."
                disabled={!currentBaseline}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
                rows={2}
              />
              
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  disabled={!currentBaseline}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                
                <input
                  type="text"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  placeholder="Tags (comma separated)"
                  disabled={!currentBaseline}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              
              {COMMON_TAGS.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-slate-500 self-center">Quick tags:</span>
                  {COMMON_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        const current = newTags.split(',').map(t => t.trim()).filter(t => t)
                        if (!current.includes(tag)) {
                          setNewTags([...current, tag].join(', '))
                        }
                      }}
                      disabled={!currentBaseline}
                      className="text-xs px-2 py-1 rounded-full bg-slate-700 hover:bg-blue-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          
          <button
            onClick={handleSave}
            disabled={!currentBaseline || saving}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold transition-colors"
          >
            {saving ? '...' : 'Save Profile'}
          </button>
        </div>
      </div>
      
      {/* Import Errors Modal */}
      {showImportModal && importErrors.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-white font-semibold mb-4">Import Results</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {importErrors.map((error, i) => (
                <p key={i} className="text-slate-400 text-sm">• {error}</p>
              ))}
            </div>
            <button
              onClick={() => {
                setShowImportModal(false)
                setImportErrors([])
              }}
              className="mt-4 w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
