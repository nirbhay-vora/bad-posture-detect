import type { SessionStats } from '../hooks/usePostureEngine'

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface Props {
  stats: SessionStats
  onReset: () => void
}

export function SessionStatsPanel({ stats, onReset }: Props) {
  const total = stats.goodSeconds + stats.badSeconds
  const goodPct = total > 0 ? Math.round((stats.goodSeconds / total) * 100) : 0

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-slate-300 font-semibold">📊 Session Stats</p>
        <button onClick={onReset} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
          Reset
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-green-400 font-bold text-lg">{fmt(stats.goodSeconds)}</p>
          <p className="text-slate-400 text-xs mt-1">Good Posture</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-red-400 font-bold text-lg">{fmt(stats.badSeconds)}</p>
          <p className="text-slate-400 text-xs mt-1">Bad Posture</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-yellow-400 font-bold text-lg">{stats.alertCount}</p>
          <p className="text-slate-400 text-xs mt-1">Alerts</p>
        </div>
      </div>

      {/* Good posture progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Session Score</span>
          <span>{goodPct}% good</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${goodPct}%`,
              backgroundColor: goodPct > 70 ? '#22c55e' : goodPct > 40 ? '#f59e0b' : '#ef4444'
            }}
          />
        </div>
      </div>
    </div>
  )
}
