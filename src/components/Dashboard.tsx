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
    case 'loading':
      return { label: 'Loading AI Model...', color: 'text-slate-400', bg: 'bg-slate-800', icon: Loader }
    case 'uncalibrated':
      return { label: 'Not Calibrated', color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: Target }
    case 'good':
      return { label: 'Good Posture ✓', color: 'text-green-400', bg: 'bg-green-900/30', icon: CheckCircle }
    case 'bad':
      return { label: 'Bad Posture!', color: 'text-red-400', bg: 'bg-red-900/30', icon: AlertTriangle }
    case 'error':
      return { label: 'Error — Check Console', color: 'text-red-500', bg: 'bg-red-950', icon: AlertTriangle }
  }
}

export function Dashboard() {
  const { videoRef, status, baseline, slouchPercent, startCamera, calibrate, showAlert, dismissAlert } = usePostureEngine()

  useEffect(() => {
    startCamera()
  }, [startCamera])

  const config = getStatusConfig(status)
  const StatusIcon = config.icon

  // Health = 100% minus the slouch percentage (clamped between 0–100)
  const healthPercent = Math.max(0, Math.min(100, 100 - slouchPercent))

  // For the circular progress bar: convert percentage to SVG stroke offset
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference

  return (
    <>
    <div className="min-h-screen bg-slate-900 text-white p-6">

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Camera className="text-blue-400" size={28} />
          ErgoVision
        </h1>
        <p className="text-slate-400 text-sm mt-1">Phase 1 — Posture Guardian</p>
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

    {/* ── Blocking Posture Alert Overlay ── */}
    {showAlert && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/95 backdrop-blur-sm">
        <div className="text-center space-y-6 p-10 max-w-md">
          <div className="text-8xl animate-bounce">🧍</div>
          <h2 className="text-4xl font-bold text-red-300">Sit Up Straight!</h2>
          <p className="text-red-200 text-lg">You've been slouching for over 10 seconds.<br />Fix your posture to dismiss this.</p>
          <button
            onClick={dismissAlert}
            className="px-8 py-3 bg-red-500 hover:bg-red-400 rounded-xl font-bold text-white text-lg transition-colors"
          >
            I've fixed my posture ✓
          </button>
        </div>
      </div>
    )}
  </>
  )
}