import React, { useState, useEffect } from 'react'
import { X, Play, Pause, Activity, RefreshCw, MoveHorizontal, Maximize } from 'lucide-react'

type StretchType = 'neck' | 'shoulder' | 'side' | 'eyes'

interface StretchGuideProps {
  primaryCause: 'slouch' | 'shoulder' | 'leaning' | 'close'
  onClose: () => void
}

const STRETCHES: Record<StretchType, { title: string; desc: string; duration: number; icon: React.ReactNode }> = {
  neck: {
    title: 'Neck Rolls & Chin Tucks',
    desc: 'Slowly roll your neck in circles. Then pull your chin straight backward to reverse forward-head posture.',
    duration: 60,
    icon: <RefreshCw size={48} className="text-blue-400 animate-spin-slow" />
  },
  shoulder: {
    title: 'Shoulder Shrugs & Drops',
    desc: 'Pull both shoulders up to your ears, squeeze tight, and then drop them completely to release tension.',
    duration: 60,
    icon: <Activity size={48} className="text-purple-400 animate-pulse" />
  },
  side: {
    title: 'Seated Side Bends',
    desc: 'Reach one arm over your head and bend your torso to the opposite side. Hold, then switch.',
    duration: 60,
    icon: <MoveHorizontal size={48} className="text-pink-400 animate-bounce" />
  },
  eyes: {
    title: '20-20-20 Eye Rest',
    desc: 'Look at something 20 feet away for at least 20 seconds. Blink fully and let your eyes relax.',
    duration: 60,
    icon: <Maximize size={48} className="text-emerald-400 animate-pulse" />
  }
}

export function StretchGuide({ primaryCause, onClose }: StretchGuideProps) {
  const [timeLeft, setTimeLeft] = useState(60)
  const [isRunning, setIsRunning] = useState(true)

  let stretchType: StretchType = 'neck'
  if (primaryCause === 'shoulder') stretchType = 'shoulder'
  if (primaryCause === 'leaning') stretchType = 'side'
  if (primaryCause === 'close') stretchType = 'eyes'

  const stretch = STRETCHES[stretchType]

  useEffect(() => {
    setTimeLeft(stretch.duration)
  }, [stretch.duration])

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft(t => t - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isRunning, timeLeft])

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins}:${s.toString().padStart(2, '0')}`
  }

  const progress = ((stretch.duration - timeLeft) / stretch.duration) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🧘 Guided Stretch <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">Personalized</span>
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center text-center">
          <div className="mb-6 p-8 bg-slate-800/50 rounded-full border border-slate-700/50 shadow-inner">
            {stretch.icon}
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-2">{stretch.title}</h3>
          <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
            {stretch.desc}
          </p>

          {/* Timer Circle */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-6">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="64" cy="64" r="60"
                className="fill-none stroke-slate-800 stroke-[8]"
              />
              <circle
                cx="64" cy="64" r="60"
                className="fill-none stroke-blue-500 stroke-[8] transition-all duration-1000 ease-linear"
                strokeDasharray={377}
                strokeDashoffset={377 - (377 * progress) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-3xl font-bold font-mono text-white">
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="flex gap-4 w-full mt-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              disabled={timeLeft === 0}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> {timeLeft === stretch.duration ? 'Start' : 'Resume'}</>}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
            >
              {timeLeft === 0 ? 'Done!' : 'Skip For Now'}
            </button>
          </div>
        </div>
      </div>
{/* Custom basic keyframes for simple visual activity */}
<style>{`
  .animate-spin-slow { animation: spin 4s linear infinite; }
`}</style>
    </div>
  )
}
