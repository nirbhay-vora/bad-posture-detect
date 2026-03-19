import { useRef, useState, useCallback, useEffect } from 'react'
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import type { Settings } from './useSettings'

const NOSE = 0
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12

export type PostureStatus = 'loading' | 'uncalibrated' | 'good' | 'bad' | 'error'

export interface Baseline {
  noseY: number
  shoulderY: number
  gap: number
}

export interface SessionStats {
  goodSeconds: number
  badSeconds: number
  alertCount: number
}

export function usePostureEngine(settings: Settings) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>(0)
  const lastVideoTimeRef = useRef(-1)
  const lastTickRef = useRef<number>(Date.now())
  const lastFrameTimeRef = useRef<number>(Date.now())
  const settingsRef = useRef(settings) // ← always up-to-date settings without re-creating detectPosture

  // Keep settingsRef in sync whenever settings change
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const [status, setStatus] = useState<PostureStatus>('loading')
  const [baseline, setBaseline] = useState<Baseline | null>(null)
  const [slouchPercent, setSlouchPercent] = useState(0)
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null)
  const [stats, setStats] = useState<SessionStats>({ goodSeconds: 0, badSeconds: 0, alertCount: 0 })

  useEffect(() => {
    async function loadModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        landmarkerRef.current = landmarker
        setStatus('uncalibrated')
      } catch (err) {
        console.error('Failed to load MediaPipe:', err)
        setStatus('error')
      }
    }
    loadModel()
  }, [])

  const detectPosture = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current

    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectPosture)
      return
    }

    if (video.currentTime === lastVideoTimeRef.current) {
      rafRef.current = requestAnimationFrame(detectPosture)
      return
    }
    lastVideoTimeRef.current = video.currentTime

    const result: PoseLandmarkerResult = landmarker.detectForVideo(video, performance.now())

    if (result.landmarks.length > 0 && baseline) {
      const lm = result.landmarks[0]
      setLandmarks(lm)

      const noseY = lm[NOSE].y
      const shoulderY = (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2
      const currentGap = shoulderY - noseY
      const deviation = 1 - currentGap / baseline.gap
      const percentage = Math.round(deviation * 100)

      setSlouchPercent(Math.max(0, percentage))

      const now = Date.now()
      const elapsed = (now - lastTickRef.current) / 1000
      lastTickRef.current = now
      lastFrameTimeRef.current = now

      const { deviationThreshold, slouchSeconds, cooldownSeconds } = settingsRef.current

      // Send posture data to main process every frame
      // Main process handles alerts/dim even when window is hidden
      window.electronAPI?.postureUpdate({
        percent: percentage,
        deviationThreshold,
        slouchSeconds,
        cooldownSeconds
      })

      if (percentage > deviationThreshold) {
        setStats(s => ({ ...s, badSeconds: s.badSeconds + elapsed }))
        setStatus('bad')
      } else {
        setStats(s => ({ ...s, goodSeconds: s.goodSeconds + elapsed }))
        setStatus('good')
      }
    } else {
      setLandmarks(null)
    }

    rafRef.current = requestAnimationFrame(detectPosture)
  }, [baseline]) // only re-create when baseline changes, not settings

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        await new Promise<void>((resolve) => { video.onloadedmetadata = () => resolve() })
        await video.play()
        rafRef.current = requestAnimationFrame(detectPosture)
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      setStatus('error')
    }
  }, [detectPosture])

  const calibrate = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker || video.readyState < 2) return

    const result = landmarker.detectForVideo(video, performance.now())
    if (result.landmarks.length === 0) {
      alert('No person detected! Make sure you are visible to the camera.')
      return
    }

    const lm = result.landmarks[0]
    const noseY = lm[NOSE].y
    const shoulderY = (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2
    const gap = shoulderY - noseY

    const newBaseline: Baseline = { noseY, shoulderY, gap }
    setBaseline(newBaseline)
    localStorage.setItem('ergovision-baseline', JSON.stringify(newBaseline))
    setStatus('good')
  }, [])

  const resetStats = useCallback(() => {
    setStats({ goodSeconds: 0, badSeconds: 0, alertCount: 0 })
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('ergovision-baseline')
    if (saved) setBaseline(JSON.parse(saved))
  }, [])

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return {
    videoRef,
    status,
    baseline,
    slouchPercent,
    landmarks,
    stats,
    startCamera,
    calibrate,
    resetStats,
  }
}
