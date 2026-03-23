import { useMemo, useState } from 'react'
import type { BadPostureEvent } from '../hooks/usePostureHistory'

interface Props {
  badEvents: BadPostureEvent[]
}

// Build a days×hours grid
// grid[dayIdx][hour] = number of bad events
// dayIdx 0 = 29 days ago, dayIdx 29 = today
const DAYS = 30
const HOURS = 24

function buildGrid(events: BadPostureEvent[]): number[][] {
  const grid: number[][] = Array.from({ length: DAYS }, () => new Array(HOURS).fill(0))
  const now = new Date()
  for (const e of events) {
    const d = new Date(e.timestamp)
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= DAYS) continue
    const dayIdx = DAYS - 1 - diffDays
    grid[dayIdx][e.hour]++
  }
  return grid
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']

function cellColor(count: number, maxVal: number): string {
  if (count === 0) return '#1e293b' // slate-800
  const ratio = Math.min(count / Math.max(maxVal, 1), 1)
  if (ratio < 0.25) return '#7f1d1d' // low
  if (ratio < 0.5) return '#b91c1c'
  if (ratio < 0.75) return '#dc2626'
  return '#ef4444'
}

export function PostureHeatmap({ badEvents }: Props) {
  const [tooltip, setTooltip] = useState<{ dayIdx: number; hour: number; count: number } | null>(null)

  const grid = useMemo(() => buildGrid(badEvents), [badEvents])
  const maxVal = useMemo(() => Math.max(...grid.flat(), 1), [grid])
  const hasData = badEvents.length > 0

  // Build day labels for x-axis (show day name for each day index)
  const dayLabels = useMemo(() => {
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (DAYS - 1 - i))
      return {
        short: DAY_LABELS[d.getDay()],
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      }
    })
  }, [])

  const tooltipDay = tooltip ? dayLabels[tooltip.dayIdx] : null
  const tooltipHour = tooltip ? tooltip.hour : 0
  const fmtHour = (h: number) => {
    const ampm = h < 12 ? 'AM' : 'PM'
    return `${h % 12 === 0 ? 12 : h % 12}:00 ${ampm}`
  }

  const CELL_SIZE = 14
  const CELL_GAP = 2

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">🔥 Bad Posture Heatmap</h2>
        <p className="text-slate-500 text-xs">{badEvents.length} events logged</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        {!hasData ? (
          <div className="h-32 flex flex-col items-center justify-center text-slate-500 gap-2">
            <span className="text-3xl">🌡️</span>
            <p className="text-sm">No bad posture events yet.</p>
            <p className="text-xs">Events will appear as you monitor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: 400 }}>
              {/* Hour labels on Y axis */}
              <div className="flex">
                <div className="flex flex-col justify-between mr-1 pt-5" style={{ height: HOURS * (CELL_SIZE + CELL_GAP) }}>
                  {HOUR_LABELS.map((label, i) => (
                    <span key={i} className="text-slate-500 text-xs leading-none" style={{ fontSize: 9 }}>
                      {label}
                    </span>
                  ))}
                </div>
                <div>
                  {/* Day labels on X axis */}
                  <div className="flex mb-1 gap-0.5">
                    {dayLabels.map((d, i) => (
                      <div
                        key={i}
                        className={`text-center ${d.isWeekend ? 'text-slate-400' : 'text-slate-600'}`}
                        style={{ width: CELL_SIZE, fontSize: 8, lineHeight: '14px' }}
                      >
                        {i % 5 === 0 ? d.short : ''}
                      </div>
                    ))}
                  </div>
                  {/* Grid: rows = hours, columns = days */}
                  <div className="flex flex-col gap-0.5">
                    {Array.from({ length: HOURS }, (_, hour) => (
                      <div key={hour} className="flex gap-0.5">
                        {Array.from({ length: DAYS }, (_, dayIdx) => {
                          const count = grid[dayIdx][hour]
                          return (
                            <div
                              key={dayIdx}
                              onMouseEnter={() => setTooltip({ dayIdx, hour, count })}
                              onMouseLeave={() => setTooltip(null)}
                              className="rounded-sm cursor-pointer transition-all hover:ring-1 hover:ring-white/30"
                              style={{
                                width: CELL_SIZE,
                                height: CELL_SIZE,
                                backgroundColor: cellColor(count, maxVal),
                              }}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tooltip */}
              {tooltip && tooltipDay && (
                <div className="mt-3 bg-slate-700 rounded-lg px-3 py-2 text-xs text-center">
                  <span className="text-slate-300">{tooltipDay.date} @ {fmtHour(tooltipHour)}: </span>
                  <span className="text-red-400 font-bold">{tooltip.count} bad posture event{tooltip.count !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-slate-500 text-xs">Less</span>
                {['#1e293b', '#7f1d1d', '#b91c1c', '#dc2626', '#ef4444'].map(c => (
                  <div key={c} className="rounded-sm" style={{ width: 12, height: 12, backgroundColor: c }} />
                ))}
                <span className="text-slate-500 text-xs">More</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
