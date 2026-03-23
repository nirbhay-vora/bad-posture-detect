import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import type { PostureSession } from '../hooks/usePostureHistory'

interface Props {
  sessions: PostureSession[]
  worstHour: { hour: number; label: string; ratio: number } | null
  onExportPdf: () => void
  onClearHistory: () => void
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function HistoryChart({ sessions, worstHour, onExportPdf, onClearHistory }: Props) {
  const [view, setView] = useState<'daily' | 'hourly'>('daily')

  // ─── Daily chart (last 14 days) ───────────────────────────────────────────
  const dailyData = useMemo(() => {
    const byDate: Record<string, { good: number; bad: number }> = {}
    for (const s of sessions) {
      if (!byDate[s.date]) byDate[s.date] = { good: 0, bad: 0 }
      byDate[s.date].good += s.goodSeconds
      byDate[s.date].bad += s.badSeconds
    }
    // Build the last 14 days grid
    const result = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const entry = byDate[key]
      const total = entry ? entry.good + entry.bad : 0
      result.push({
        date: shortDate(key),
        score: total > 0 ? Math.round((entry!.good / total) * 100) : null as number | null,
      })
    }
    return result
  }, [sessions])

  // ─── Hourly chart (average % good per hour across all days) ──────────────
  const hourlyData = useMemo(() => {
    const byHour: Record<number, { good: number; bad: number }> = {}
    for (const s of sessions) {
      const h = s.hour
      if (!byHour[h]) byHour[h] = { good: 0, bad: 0 }
      byHour[h].good += s.goodSeconds
      byHour[h].bad += s.badSeconds
    }
    return Array.from({ length: 24 }, (_, h) => {
      const entry = byHour[h]
      const total = entry ? entry.good + entry.bad : 0
      const fmt = (h: number) => {
        const ampm = h < 12 ? 'AM' : 'PM'
        return `${h % 12 === 0 ? 12 : h % 12}${ampm}`
      }
      return {
        hour: fmt(h),
        score: total > 0 ? Math.round((entry!.good / total) * 100) : null as number | null,
      }
    })
  }, [sessions])

  const chartData = view === 'daily' ? dailyData : hourlyData
  const hasData = sessions.length > 0

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || payload[0].value == null) return null
    const v = payload[0].value as number
    const color = v > 70 ? '#22c55e' : v > 40 ? '#f59e0b' : '#ef4444'
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-bold" style={{ color }}>{v}% good posture</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">📈 Posture History</h2>
          <p className="text-slate-400 text-xs mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} logged</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            {(['daily', 'hourly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${view === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {v === 'daily' ? '14-Day' : 'By Hour'}
              </button>
            ))}
          </div>
          <button
            onClick={onExportPdf}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            📄 Export PDF
          </button>
          <button
            onClick={onClearHistory}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-400 text-xs font-semibold transition-colors"
          >
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        {!hasData ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 gap-2">
            <span className="text-3xl">📊</span>
            <p className="text-sm">No session data yet.</p>
            <p className="text-xs">Start a monitoring session to build your history.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={view === 'daily' ? 'date' : 'hour'}
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={view === 'daily' ? 1 : 2}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 2" opacity={0.4} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#60a5fa' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Worst hour insight */}
      {worstHour && (
        <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3">
          <span className="text-2xl">⏰</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">Worst Time of Day</p>
            <p className="text-slate-300 text-xs mt-0.5">
              You slouch most between <span className="text-amber-300 font-bold">{worstHour.label}</span>
              {' '}— {Math.round(worstHour.ratio * 100)}% of that hour is bad posture.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
