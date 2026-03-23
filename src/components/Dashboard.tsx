import { useEffect, useState, useCallback, useRef } from 'react'
import { Camera, CheckCircle, AlertTriangle, Loader, Target, Settings as SettingsIcon, BarChart2, Activity } from 'lucide-react'
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

type Tab = 'monitor' | 'stats' | 'analytics' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
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

  const {
    videoRef, status, baseline, slouchPercent, landmarks, stats, isMonitoring,
    needsBreak, startCamera, calibrate, resetStats, toggleMonitoring, dismissBreak, setOnBadPostureEvent
  } = usePostureEngine(settings, activeProfile?.baseline)

  const [tab, setTab] = useState<Tab>('monitor')
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

        {/* Break Reminder Banner */}
        {needsBreak && (
          <div className="mb-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 animate-pulse-once">
            <span className="text-2xl">🚶</span>
            <div className="flex-1">
              <p className="text-amber-300 font-semibold text-sm">Time for a 5-Minute Walk!</p>
              <p className="text-amber-200/70 text-xs">You've been sitting for {settings.breakReminderMinutes} minutes. Movement helps your focus and health.</p>
            </div>
            <button
              onClick={dismissBreak}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
            >
              Got it!
            </button>
          </div>
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
            {/* On/Off Toggle */}
            <button
              onClick={toggleMonitoring}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
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
                  onClick={() => setTab(id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Monitor Tab ────────────────────────────────────────────────────── */}
        <div className={tab === 'monitor' ? '' : 'hidden'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left: Webcam + Skeleton */}
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700 aspect-video relative">
                <video ref={videoRef} className={`w-full h-full object-cover mirror ${!isMonitoring ? 'invisible' : ''}`} muted playsInline />
                {isMonitoring
                  ? <SkeletonOverlay landmarks={landmarks} status={status} />
                  : <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-3">
                      <span className="text-5xl">⏸</span>
                      <p className="text-slate-400 text-sm">Monitoring is paused</p>
                      <p className="text-slate-500 text-xs">Toggle ON to resume</p>
                    </div>
                }
                <div className={`absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} flex items-center gap-1`}>
                  <StatusIcon size={12} />
                  {config.label}
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
        {tab === 'stats' && (
          <SessionStatsPanel stats={stats} onReset={handleResetStats} />
        )}

        {/* ─── Analytics Tab ──────────────────────────────────────────────────── */}
        {tab === 'analytics' && (
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
        {tab === 'settings' && (
          <SettingsPanel settings={settings} onChange={updateSettings} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Left: Webcam Feed ── */}
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700 aspect-video relative">
            {/* The actual video element — videoRef is set here */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover mirror"
              muted
              playsInline
            />
            {/* Overlay badge */}
            <div className={`absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} flex items-center gap-1`}>
              <StatusIcon size={12} />
              {config.label}
            </div>
          </div>

          {/* Calibrate Button */}
          <button
            onClick={calibrate}
            disabled={status === 'loading' || status === 'error'}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Target size={18} />
            {baseline ? 'Re-Calibrate Posture' : 'Calibrate (Sit Up Straight First!)'}
          </button>
        </div>

        {/* ── Right: Stats ── */}
        <div className="space-y-4">

          {/* Circular Health Meter */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-center">
            <p className="text-slate-400 text-sm mb-4 font-medium">Posture Health</p>

            {/* SVG Radial Progress Bar */}
            <svg width="140" height="140" viewBox="0 0 140 140">
              {/* Background ring */}
              <circle
                cx="70" cy="70" r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth="12"
              />
              {/* Foreground ring — color changes based on health */}
              <circle
                cx="70" cy="70" r={radius}
                fill="none"
                stroke={healthPercent > 60 ? '#22c55e' : healthPercent > 30 ? '#f59e0b' : '#ef4444'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                // Start from the top of the circle (default starts at right)
                transform="rotate(-90 70 70)"
                className="transition-all duration-500"
              />
              {/* Center text */}
              <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="22" fontWeight="bold">
                {healthPercent}%
              </text>
            </svg>
          </div>

          {/* Slouch Details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            <p className="text-slate-400 text-sm font-medium">Detection Details</p>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Slouch Deviation</span>
              <span className={slouchPercent > 20 ? 'text-red-400 font-bold' : 'text-green-400'}>
                {slouchPercent}%
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Baseline Set</span>
              <span className={baseline ? 'text-green-400' : 'text-yellow-400'}>
                {baseline ? 'Yes ✓' : 'No — Please Calibrate'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Alert Threshold</span>
              <span className="text-slate-300">20% deviation × 150 frames</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-600 p-4">
            <p className="text-slate-300 text-xs leading-relaxed">
              <strong className="text-white">How to use:</strong><br />
              1. Sit in your ideal posture<br />
              2. Click <strong>"Calibrate"</strong> to set your baseline<br />
              3. ErgoVision will now monitor you and send an OS notification if you slouch for ~5 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}