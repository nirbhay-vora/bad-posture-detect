// Dashboard.tsx is the main (and only) screen of the app.
// It uses the usePostureEngine hook for all the logic
// and just focuses on displaying things nicely.

import { useEffect } from 'react'
import { Camera, CheckCircle, AlertTriangle, Loader, Target } from 'lucide-react'
import { usePostureEngine, type PostureStatus } from '../hooks/usePostureEngine'

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

export function Dashboard() {
  const { settings, updateSettings } = useSettings()
  const { videoRef, status, baseline, slouchPercent, landmarks, stats, isMonitoring, startCamera, calibrate, resetStats, toggleMonitoring } = usePostureEngine(settings)
  const [tab, setTab] = useState<Tab>('monitor')

  useEffect(() => {
    startCamera()
  }, [startCamera])

  const config = getStatusConfig(status)
  const StatusIcon = config.icon
  const healthPercent = isMonitoring ? Math.max(0, Math.min(100, 100 - slouchPercent)) : 0
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Camera className="text-blue-400" size={28} />
              ErgoVision
            </h1>
            <p className="text-slate-400 text-sm mt-1">Phase 2 — Posture Guardian</p>
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
              {(['monitor', 'stats', 'settings'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Video always in DOM — just hidden on other tabs to keep camera stream alive */}
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
                onClick={calibrate}
                disabled={status === 'loading' || status === 'error'}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Target size={18} />
                {baseline ? 'Re-Calibrate Posture' : 'Calibrate (Sit Up Straight First!)'}
              </button>
            </div>

            {/* Right: Health Meter + Details */}
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-center">
                <p className="text-slate-400 text-sm mb-4 font-medium">Posture Health</p>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r={radius} fill="none" stroke="#1e293b" strokeWidth="12" />
                  <circle
                    cx="70" cy="70" r={radius} fill="none"
                    stroke={healthPercent > 60 ? '#22c55e' : healthPercent > 30 ? '#f59e0b' : '#ef4444'}
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
                  <span className="text-slate-400">Baseline Set</span>
                  <span className={baseline ? 'text-green-400' : 'text-yellow-400'}>{baseline ? 'Yes ✓' : 'No — Please Calibrate'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Alert Threshold</span>
                  <span className="text-slate-300">{settings.deviationThreshold}% × {settings.slouchSeconds}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Tab */}
        {tab === 'stats' && (
          <SessionStatsPanel stats={stats} onReset={resetStats} />
        )}

        {/* Settings Tab */}
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