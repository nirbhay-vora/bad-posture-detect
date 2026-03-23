import { useCallback } from 'react'
import type { PostureSession } from './usePostureHistory'

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${Math.floor(seconds % 60)}s`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function usePdfExport() {
  const exportPdf = useCallback(async (sessions: PostureSession[]) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const primaryColor: [number, number, number] = [59, 130, 246]   // blue-500
    const darkColor: [number, number, number] = [15, 23, 42]        // slate-900
    const textColor: [number, number, number] = [51, 65, 85]        // slate-700
    const goodColor: [number, number, number] = [34, 197, 94]       // green-500
    const badColor: [number, number, number] = [239, 68, 68]        // red-500

    // ─── Background header ────────────────────────────────────────────────────
    doc.setFillColor(...darkColor)
    doc.rect(0, 0, 210, 45, 'F')

    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, 8, 45, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('ErgoVision', 18, 18)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184) // slate-400
    doc.text('Posture Score Report', 18, 27)

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139) // slate-500
    doc.text(
      `Generated: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      18, 36
    )
    doc.text(
      `Period: ${formatDate(weekStart.toISOString().split('T')[0])} – ${formatDate(now.toISOString().split('T')[0])}`,
      18, 42
    )

    // ─── Filter last 7 days ───────────────────────────────────────────────────
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000
    const recent = sessions.filter(s => s.timestamp >= cutoff)

    // ─── Summary stats ────────────────────────────────────────────────────────
    const totalGood = recent.reduce((a, s) => a + s.goodSeconds, 0)
    const totalBad = recent.reduce((a, s) => a + s.badSeconds, 0)
    const totalAlerts = recent.reduce((a, s) => a + s.alertCount, 0)
    const totalTime = totalGood + totalBad
    const goodPct = totalTime > 0 ? Math.round((totalGood / totalTime) * 100) : 0

    let y = 60
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textColor)
    doc.text('Weekly Summary', 15, y)

    y += 8
    const boxes = [
      { label: 'Overall Score', value: `${goodPct}%`, color: goodPct > 70 ? goodColor : goodPct > 40 ? [245, 158, 11] as [number,number,number] : badColor },
      { label: 'Good Posture', value: fmt(totalGood), color: goodColor },
      { label: 'Bad Posture', value: fmt(totalBad), color: badColor },
      { label: 'Total Alerts', value: String(totalAlerts), color: primaryColor },
    ]

    const boxW = 44
    const boxH = 22
    const startX = 15
    boxes.forEach((b, i) => {
      const x = startX + i * (boxW + 4)
      doc.setFillColor(241, 245, 249) // slate-100
      doc.roundedRect(x, y, boxW, boxH, 3, 3, 'F')
      doc.setFillColor(...b.color)
      doc.roundedRect(x, y, 3, boxH, 1.5, 0, 'F')
      doc.setTextColor(...b.color)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(b.value, x + 7, y + 10)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...textColor)
      doc.text(b.label, x + 7, y + 17)
    })

    y += 32

    // ─── Day-by-day table ─────────────────────────────────────────────────────
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textColor)
    doc.text('Day-by-Day Breakdown', 15, y)
    y += 8

    // Group by date
    const byDate: Record<string, PostureSession[]> = {}
    for (const s of recent) {
      byDate[s.date] = [...(byDate[s.date] ?? []), s]
    }

    // Table header
    doc.setFillColor(...darkColor)
    doc.rect(15, y, 180, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    const cols = [15, 65, 105, 145, 165]
    const headers = ['Date', 'Good Posture', 'Bad Posture', 'Score', 'Alerts']
    headers.forEach((h, i) => doc.text(h, cols[i] + 3, y + 5.5))
    y += 8

    const dates = Object.keys(byDate).sort()
    let bestDay = { date: '', pct: -1 }
    let worstDay = { date: '', pct: 101 }

    dates.forEach((date, idx) => {
      const rows = byDate[date]
      const good = rows.reduce((a, s) => a + s.goodSeconds, 0)
      const bad = rows.reduce((a, s) => a + s.badSeconds, 0)
      const alerts = rows.reduce((a, s) => a + s.alertCount, 0)
      const total = good + bad
      const pct = total > 0 ? Math.round((good / total) * 100) : 0

      if (pct > bestDay.pct) bestDay = { date, pct }
      if (pct < worstDay.pct) worstDay = { date, pct }

      doc.setFillColor(idx % 2 === 0 ? 248 : 241, idx % 2 === 0 ? 250 : 245, idx % 2 === 0 ? 252 : 249)
      doc.rect(15, y, 180, 8, 'F')

      doc.setTextColor(...textColor)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(formatDate(date), cols[0] + 3, y + 5.5)
      doc.text(fmt(good), cols[1] + 3, y + 5.5)
      doc.text(fmt(bad), cols[2] + 3, y + 5.5)

      // Score cell with color dot
      const scoreColor: [number, number, number] = pct > 70 ? goodColor : pct > 40 ? [245, 158, 11] : badColor
      doc.setFillColor(...scoreColor)
      doc.circle(cols[3] + 5, y + 4, 1.5, 'F')
      doc.setTextColor(...scoreColor)
      doc.setFont('helvetica', 'bold')
      doc.text(`${pct}%`, cols[3] + 8, y + 5.5)
      doc.setTextColor(...textColor)
      doc.setFont('helvetica', 'normal')
      doc.text(String(alerts), cols[4] + 3, y + 5.5)

      y += 8
    })

    if (dates.length === 0) {
      doc.setTextColor(148, 163, 184)
      doc.setFontSize(9)
      doc.text('No session data for this period.', 15, y + 6)
      y += 14
    }

    // ─── Best / worst day ─────────────────────────────────────────────────────
    y += 8
    if (bestDay.date && worstDay.date && bestDay.date !== worstDay.date) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...textColor)
      doc.text('Insights', 15, y)
      y += 7

      doc.setFillColor(240, 253, 244) // green-50
      doc.roundedRect(15, y, 85, 14, 3, 3, 'F')
      doc.setFillColor(...goodColor)
      doc.roundedRect(15, y, 3, 14, 1.5, 0, 'F')
      doc.setTextColor(...goodColor)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('🏆 Best Day', 21, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...textColor)
      doc.text(`${formatDate(bestDay.date)} — ${bestDay.pct}% good posture`, 21, y + 10)

      doc.setFillColor(254, 242, 242) // red-50
      doc.roundedRect(110, y, 85, 14, 3, 3, 'F')
      doc.setFillColor(...badColor)
      doc.roundedRect(110, y, 3, 14, 1.5, 0, 'F')
      doc.setTextColor(...badColor)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('⚠ Needs Improvement', 116, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...textColor)
      doc.text(`${formatDate(worstDay.date)} — ${worstDay.pct}% good posture`, 116, y + 10)
    }

    // ─── Footer ───────────────────────────────────────────────────────────────
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.line(15, 280, 195, 280)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('ErgoVision — Posture Guardian  |  Phase 3 Intelligence & Analytics', 15, 285)
    doc.text('This report is auto-generated and for wellness reference only.', 15, 289)

    // ─── Save ─────────────────────────────────────────────────────────────────
    const filename = `ergovision-report-${now.toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  }, [])

  return { exportPdf }
}
