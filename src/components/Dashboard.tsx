import { useEffect, useState, useCallback, useRef } from 'react'
import { Camera, CheckCircle, AlertTriangle, Loader, Target, Settings as SettingsIcon, BarChart2, Activity, X, Shield } from 'lucide-react'
import { usePostureEngine, type PostureStatus } from '../hooks/usePostureEngine'
import { useSettings } from '../hooks/useSettings'
import { usePostureHistory } from '../hooks/usePostureHistory'
import { useProfiles } from '../hooks/useProfiles'
import { usePdfExport } from '../hooks/usePdfExport'
import { SkeletonOverlay } from './SkeletonOverlay'
import { SettingsPanel } from './SettingsPanel'
import { SessionStatsPanel } from './SessionStatsPanel'
import { HistoryChart } from './HistoryChart'
import { PostureHeatmap } from './PostureHeatmap'
import { ProfileManager } from './ProfileManager'
import { StretchGuide } from './StretchGuide'

// ── Helper: status-based config ──────────────────────────────────────────────
// Instead of if/else chains in JSX, we map status → display properties here.
function getStatusConfig(status: PostureStatus) {
  switch (status) {
    case 'loading':      return { label: 'Loading AI Model...', color: 'text-slate-400', bg: 'bg-slate-800', icon: Loader }
    case 'uncalibrated': return { label: 'Not Calibrated', color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: Target }
    case 'good':         return { label: 'Good Posture ✓', color: 'text-green-400', bg: 'bg-green-900/30', icon: CheckCircle }
    case 'bad':          return { label: 'Bad Posture!', color: 'text-red-400', bg: 'bg-red-900/30', icon: AlertTriangle }
    case 'error':        return { label: 'Error — Check Console', color: 'text-red-500', bg: 'bg-red-950', icon: AlertTriangle }
    case 'paused':       return { label: 'Monitoring Paused', color: 'text-slate-400', bg: 'bg-slate-800', icon: Loader }
  }
}

import type { LucideIcon } from 'lucide-react'

type Tab = 'monitor' | 'stats' | 'analytics' | 'settings'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
  { id: 'analytics', label: 'Analytics', icon: Camera },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function Dashboard() {
  const { settings, updateSettings } = useSettings()
  const { sessions, badEvents, addSession, logBadPostureEvent, clearHistory, worstHour } = usePostureHistory()
  const { profiles, activeProfile, activeProfileId, addProfile, switchProfile, deleteProfile } = useProfiles()
  const { exportPdf } = usePdfExport()

  const [focusUntil, setFocusUntil] = useState<number | null>(null)

  useEffect(() => {
    if (!focusUntil) return
    const interval = setInterval(() => {
      // Force re-render to update the countdown
      setFocusUntil(prev => {
        if (!prev || Date.now() > prev) return null
        return prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [focusUntil])

  const formatTimeLeft = (targetTime: number) => {
    const s = Math.ceil(Math.max(0, targetTime - Date.now()) / 1000)
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  const {
    videoRef, 
    status, 
    baseline, 
    slouchPercent, 
    feedback,
    landmarks, 
    stats, 
    isMonitoring, 
    needsBreak,
    startCamera, 
    calibrate, 
    resetStats, 
    toggleMonitoring, 
    dismissBreak, setOnBadPostureEvent
  } = usePostureEngine(settings, activeProfile?.baseline, focusUntil !== null)

  const [activeTab, setActiveTab] = useState<Tab>('monitor')
  const [showStretchModal, setShowStretchModal] = useState(false)
  const [showTuning, setShowTuning] = useState(false)
  const prevStatsRef = useRef(stats)

  // Wire bad posture event logging to heatmap
  useEffect(() => {
    setOnBadPostureEvent(logBadPostureEvent)
  }, [setOnBadPostureEvent, logBadPostureEvent])

  // Save session to history when component unmounts or stats reset
  const saveSession = useCallback(() => {
    const s = prevStatsRef.current
    if (s.goodSeconds + s.badSeconds > 5) {
      addSession(s)
    }
  }, [addSession])

  useEffect(() => {
    prevStatsRef.current = stats
  }, [stats])

  useEffect(() => {
    return () => { saveSession() }
  }, [saveSession])

  // Save session on stats reset too
  const handleResetStats = useCallback(() => {
    saveSession()
    resetStats()
  }, [saveSession, resetStats])

  // Save session on calibrate (new session begins)
  const handleCalibrate = useCallback(() => {
    saveSession()
    resetStats()
    switchProfile(null) // Clear active profile since we are creating a new manual calibration
    return calibrate()
  }, [calibrate, saveSession, resetStats, switchProfile])

  useEffect(() => {
    startCamera()
  }, [startCamera])

  const config = getStatusConfig(status)
  const StatusIcon = config.icon
  const healthPercent = isMonitoring ? Math.max(0, Math.min(100, 100 - slouchPercent)) : 0
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference
  const strokeColor = healthPercent > 60 ? '#22c55e' : healthPercent > 30 ? '#f59e0b' : '#ef4444'

  // Live sensitivity indicator: how severe current deviation vs threshold
  const sensitivityRatio = settings.deviationThreshold > 0 ? slouchPercent / settings.deviationThreshold : 0
  const sensitivityColor = !isMonitoring ? '#64748b' : sensitivityRatio > 1 ? '#ef4444' : sensitivityRatio > 0.7 ? '#f59e0b' : '#22c55e'

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">

        {/* Feature 2 & 3: Break Reminder Banner */}
      {needsBreak && !showStretchModal && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-900 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-3 animate-bounce z-50">
          <Activity size={20} />
          Your body needs to stretch!
          <button 
            onClick={() => setShowStretchModal(true)} 
            className="ml-2 bg-slate-900 text-yellow-500 px-3 py-1 rounded-full text-sm hover:bg-slate-800 transition-colors"
          >
            Start Stretches
          </button>
          <button onClick={dismissBreak} className="ml-2 text-slate-800 hover:text-slate-900">
            <X size={16} />
          </button>
        </div>
      )}

      {showStretchModal && (
        <StretchGuide 
          primaryCause={
            ['shoulder', 'leaning', 'close', 'slouch'].reduce((a, b) => 
              stats.causes[a as keyof typeof stats.causes] > stats.causes[b as keyof typeof stats.causes] ? a : b
            ) as any
          }
          onClose={() => {
            setShowStretchModal(false)
            dismissBreak()
          }}
        />
      )}

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Camera className="text-blue-400" size={28} />
              ErgoVision
            </h1>
            <p className="text-slate-400 text-sm mt-1">Phase 3 — Intelligence & Analytics</p>
            {activeProfile && (
              <p className="text-blue-400 text-xs mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                Profile: {activeProfile.name}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Focus Mode Toggle */}
            <button
              onClick={() => {
                if (focusUntil) setFocusUntil(null)
                else setFocusUntil(Date.now() + 25 * 60 * 1000)
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-md ${
                focusUntil ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300'
              }`}
            >
              🍅 {focusUntil ? formatTimeLeft(focusUntil) : 'Focus Mode'}
            </button>

            {/* On/Off Toggle */}
            <button
              onClick={toggleMonitoring}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-md ${
                isMonitoring
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-300 animate-pulse' : 'bg-slate-500'}`} />
              {isMonitoring ? 'Monitoring ON' : 'Monitoring OFF'}
            </button>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Monitor Tab ────────────────────────────────────────────────────── */}
        <div className={activeTab === 'monitor' ? '' : 'hidden'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left: Webcam + Skeleton */}
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700 aspect-video relative">
                {settings.privacyMode && isMonitoring && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-0 border-b border-slate-800">
                    <Shield size={48} className="text-emerald-500/50 mb-3" />
                    <p className="text-emerald-400 font-medium text-sm">Ghost Mode Active</p>
                    <p className="text-slate-500 text-xs">AI running locally without video preview</p>
                  </div>
                )}
                <video ref={videoRef} className={`w-full h-full object-cover mirror ${(!isMonitoring || settings.privacyMode) ? 'opacity-0' : ''}`} muted playsInline />
                {isMonitoring
                  ? <SkeletonOverlay landmarks={landmarks} status={status} />
                  : <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-3 z-10">
                      <span className="text-5xl">⏸</span>
                      <p className="text-slate-400 text-sm">Monitoring is paused</p>
                      <p className="text-slate-500 text-xs">Toggle ON to resume</p>
                    </div>
                }
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent flex items-end justify-between">
                  <div>
                    <h3 className="font-semibold text-lg drop-shadow-md">Live Feed</h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-slate-200 font-medium">
                        {Math.round(slouchPercent)}% Deviation
                      </p>
                      {isMonitoring && baseline && (
                        <p className={`text-sm font-semibold max-w-sm leading-tight transition-colors duration-300 ${status === 'bad' ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                          {feedback}
                        </p>
                      )}
                    </div>
                  </div>
                  {isMonitoring && baseline && landmarks && (
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} flex items-center gap-1`}>
                      <StatusIcon size={12} />
                      {config.label}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleCalibrate}
                disabled={status === 'loading' || status === 'error'}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Target size={18} />
                {baseline || activeProfile ? 'Re-Calibrate Posture' : 'Calibrate (Sit Up Straight First!)'}
              </button>

              {/* Feature 6: Live Sensitivity Tuning */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setShowTuning(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <SettingsIcon size={13} />
                    ⚙ Tune Sensitivity
                  </span>
                  <span className="text-xs">{showTuning ? '▲' : '▼'}</span>
                </button>
                {showTuning && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-slate-400">Deviation Threshold</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full transition-all duration-300" style={{ backgroundColor: sensitivityColor }} />
                        <span className="text-white font-bold">{settings.deviationThreshold}%</span>
                      </div>
                    </div>
                    <input
                      type="range" min={5} max={50}
                      value={settings.deviationThreshold}
                      onChange={e => updateSettings({ deviationThreshold: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>🟢 Lenient (5%)</span>
                      <span>Current: {slouchPercent}% deviation</span>
                      <span>🔴 Strict (50%)</span>
                    </div>
                    {isMonitoring && baseline && (
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          background: `linear-gradient(to right, #22c55e ${settings.deviationThreshold}%, #ef4444 ${settings.deviationThreshold}%)`,
                          boxShadow: sensitivityRatio > 1 ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(34,197,94,0.3)'
                        }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(slouchPercent * 2, 100)}%`,
                            backgroundColor: sensitivityColor,
                            opacity: 0.7
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Health Meter + Details */}
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-center">
                <p className="text-slate-400 text-sm mb-4 font-medium">Posture Health</p>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r={radius} fill="none" stroke="#1e293b" strokeWidth="12" />
                  <circle
                    cx="70" cy="70" r={radius} fill="none"
                    stroke={strokeColor}
                    strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 70 70)" className="transition-all duration-500"
                  />
                  <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="22" fontWeight="bold">
                    {healthPercent}%
                  </text>
                </svg>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
                <p className="text-slate-400 text-sm font-medium">Detection Details</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Slouch Deviation</span>
                  <span className={!isMonitoring ? 'text-slate-500' : slouchPercent > settings.deviationThreshold ? 'text-red-400 font-bold' : 'text-green-400'}>
                    {isMonitoring ? `${slouchPercent}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Baseline / Profile</span>
                  <span className={baseline || activeProfile ? 'text-green-400' : 'text-yellow-400'}>
                    {activeProfile ? `✓ ${activeProfile.name}` : baseline ? 'Yes ✓' : 'No — Please Calibrate'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Alert Threshold</span>
                  <span className="text-slate-300">{settings.deviationThreshold}% × {settings.slouchSeconds}s</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Break Reminder</span>
                  <span className={settings.breakReminderEnabled ? 'text-amber-400' : 'text-slate-500'}>
                    {settings.breakReminderEnabled ? `Every ${settings.breakReminderMinutes} min` : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Stats Tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <SessionStatsPanel stats={stats} onReset={handleResetStats} />
        )}

        {/* ─── Analytics Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <HistoryChart
              sessions={sessions}
              worstHour={worstHour}
              onExportPdf={() => exportPdf(sessions)}
              onClearHistory={clearHistory}
            />
            <PostureHeatmap badEvents={badEvents} />
            <ProfileManager
              profiles={profiles}
              activeProfileId={activeProfileId}
              currentBaseline={baseline}
              onSwitch={switchProfile}
              onAdd={addProfile}
              onDelete={deleteProfile}
            />
          </div>
        )}

        {/* ─── Settings Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <SettingsPanel settings={settings} onChange={updateSettings} />
        )}
      </div>
  )
}