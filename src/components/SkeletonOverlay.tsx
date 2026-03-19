import { useEffect, useRef } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// MediaPipe pose connections — pairs of landmark indices to draw bones
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // arms
  [11, 23], [12, 24], [23, 24],                       // torso
  [23, 25], [25, 27], [24, 26], [26, 28],             // legs
  [0, 11],  [0, 12],                                  // nose to shoulders
]

interface Props {
  landmarks: NormalizedLandmark[] | null
  status: 'good' | 'bad' | 'loading' | 'uncalibrated' | 'error'
}

export function SkeletonOverlay({ landmarks, status }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!landmarks) return

    const w = canvas.width
    const h = canvas.height
    const color = status === 'bad' ? '#ef4444' : '#22c55e'

    // Draw bones
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.8
    for (const [a, b] of CONNECTIONS) {
      const lmA = landmarks[a]
      const lmB = landmarks[b]
      if (!lmA || !lmB) continue
      ctx.beginPath()
      // Mirror horizontally (scaleX -1) to match mirrored video
      ctx.moveTo(w - lmA.x * w, lmA.y * h)
      ctx.lineTo(w - lmB.x * w, lmB.y * h)
      ctx.stroke()
    }

    // Draw joints
    ctx.fillStyle = color
    ctx.globalAlpha = 1
    for (const lm of landmarks) {
      ctx.beginPath()
      ctx.arc(w - lm.x * w, lm.y * h, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [landmarks, status])

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
