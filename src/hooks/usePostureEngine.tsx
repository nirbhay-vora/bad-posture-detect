// This is a React "custom hook" — a function that packages up
// related logic and state so Dashboard.tsx stays clean.
//
// This hook:
// 1. Loads MediaPipe's Pose Landmarker
// 2. Runs detection on every animation frame
// 3. Tracks a "slouch buffer" (150 bad frames = alert)
// 4. Calls notify() when posture is bad

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision'
import type { Settings } from './useSettings'

// Pose landmark indices from MediaPipe's 33-point body model
// Full list: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
const NOSE = 0
const LEFT_EAR = 7
const RIGHT_EAR = 8
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12

export type PostureStatus = 'loading' | 'uncalibrated' | 'good' | 'bad' | 'error' | 'paused'

export interface Baseline {
  noseY: number
  shoulderY: number
  gap: number        // vertical distance between nose and shoulder
  shoulderWidth?: number
  noseXDeviation?: number
  shoulderTilt?: number
}

export interface SessionStats {
  goodSeconds: number
  badSeconds: number
  alertCount: number
  causes: { slouch: number; leaning: number; shoulder: number; close: number }
}

export function usePostureEngine(
  settings: Settings,
  externalBaseline?: Baseline | null,   // Feature 4: injected from active profile
  isFocusMode: boolean = false
) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  
  // Reference to the <video> element (set by Dashboard.tsx)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  
  // requestAnimationFrame ID — stored so we can cancel the loop
  const rafRef = useRef<number>(0)
  
  // Counts consecutive bad-posture frames
  const slouchBufferRef = useRef(0)
  const cooldownRef = useRef(0)
  const isDimmedRef = useRef(false)
  const onBadPostureEventRef = useRef<(() => void) | null>(null)
  const setOnBadPostureEvent = useCallback((cb: () => void) => { onBadPostureEventRef.current = cb }, [])
  const lastVideoTimeRef = useRef(-1)
  const lastTickRef = useRef<number>(Date.now())
  const settingsRef = useRef(settings)
  const isMonitoringRef = useRef(true)

  // Break reminder
  const sittingStartRef = useRef<number>(Date.now())
  const breakCooldownUntilRef = useRef<number>(0)
  const [needsBreak, setNeedsBreak] = useState(false)

  useEffect(() => { settingsRef.current = settings }, [settings])

  const [status, setStatus] = useState<PostureStatus>('loading')
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [baseline, setBaseline] = useState<Baseline | null>(() => {
    const saved = localStorage.getItem('ergovision-baseline')
    return saved ? JSON.parse(saved) : null
  })
  const [slouchPercent, setSlouchPercent] = useState(0)
  const [feedback, setFeedback] = useState("Calibrate to begin monitoring")
  const lastFeedbackRef = useRef("Calibrate to begin monitoring")
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null)
  const [stats, setStats] = useState<SessionStats>({
    goodSeconds: 0, badSeconds: 0, alertCount: 0,
    causes: { slouch: 0, leaning: 0, shoulder: 0, close: 0 }
  })

  // ─── Step 1: Load the MediaPipe model ───────────────────────────────────────
  useEffect(() => {
    async function loadModel() {
      try {
        // FilesetResolver downloads the WASM runtime from Google's CDN.
        // WASM = WebAssembly, a binary format that runs at near-native speed in the browser.
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )

        // Create the Pose Landmarker using the CDN model
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU', // Use GPU if available, falls back to CPU
          },
          runningMode: 'VIDEO',   // VIDEO mode = optimized for continuous frames
          numPoses: 1,            // We only need to detect one person
        })

        landmarkerRef.current = landmarker
        setStatus('uncalibrated') // Model loaded! Now user needs to calibrate.
      } catch (err) {
        console.error('Failed to load MediaPipe:', err)
        setStatus('error')
      }
    }

    loadModel()
  }, [])

  // ─── Step 2: The main detection loop ────────────────────────────────────────
  const detectPosture = useCallback(() => {
    if (!isMonitoringRef.current) return

    const video = videoRef.current
    const landmarker = landmarkerRef.current

    // Guard: if video isn't ready or model isn't loaded, skip this frame
    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectPosture)
      return
    }

    // Skip if we already processed this video frame
    // (MediaPipe requires timestamps to go forward)
    if (video.currentTime === lastVideoTimeRef.current) {
      rafRef.current = requestAnimationFrame(detectPosture)
      return
    }
    lastVideoTimeRef.current = video.currentTime

    const result: PoseLandmarkerResult = landmarker.detectForVideo(video, performance.now())

    if (result.landmarks.length > 0 && (baseline || externalBaseline)) {
      const activeBaseline = externalBaseline || baseline!
      const lm = result.landmarks[0]
      setLandmarks(lm)

      const noseY = lm[NOSE].y
      const shoulderY =
        (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2

      // ── The Slouch Formula ──────────────────────────────────────────────────
      // During calibration we stored the "ideal" nose position and shoulder position.
      // Now we calculate how much the user has deviated from that ideal.
      //
      // When you slouch, your nose drops closer to your shoulders.
      // So (shoulderY - noseY) gets smaller when you slouch.
      //
      // Formula: 1 - (current gap / baseline gap)
      //   • Perfect posture = current gap ≈ baseline gap → result ≈ 0% (0 deviation)
      //   • Bad posture     = current gap is smaller      → result > 0% (positive deviation)
      const currentGap = shoulderY - noseY
      const slouchDev = Math.max(0, (1 - currentGap / activeBaseline.gap) * 100)

      let percentage = slouchDev
      let currentFeedback = "Good posture! Keep it up."
      let badType: 'slouch' | 'leaning' | 'shoulder' | 'close' | null = null

      if (activeBaseline.shoulderWidth !== undefined) {
         const w = Math.abs(lm[RIGHT_SHOULDER].x - lm[LEFT_SHOULDER].x)
         const nx = lm[NOSE].x - (lm[LEFT_SHOULDER].x + lm[RIGHT_SHOULDER].x) / 2
         const tilt = lm[LEFT_SHOULDER].y - lm[RIGHT_SHOULDER].y

         const closeDev = Math.max(0, ((w / activeBaseline.shoulderWidth) - 1.1) * 800)
         const tiltDev = Math.max(0, (Math.abs(tilt - activeBaseline.shoulderTilt!) - 0.03) * 1000)
         const leanDev = Math.max(0, (Math.abs(nx - activeBaseline.noseXDeviation!) - 0.04) * 1000)

         // Feature 9: Desk Setup Awareness
         const dxLeft = Math.abs(lm[NOSE].x - lm[LEFT_EAR].x)
         const dxRight = Math.abs(lm[NOSE].x - lm[RIGHT_EAR].x)
         const deskDevLeft = dxLeft > dxRight * 2.5 ? 35 : 0
         const deskDevRight = dxRight > dxLeft * 2.5 ? 35 : 0

         const deviations = [
           { type: 'slouch', val: slouchDev, msg: "Your neck is straining forward. Pull your chin back." },
           { type: 'close', val: closeDev, msg: "You're too close to the screen. Move back." },
           { type: 'shoulder', val: tiltDev, msg: "One shoulder is raised. Relax your shoulders." },
           { type: 'leaning', val: leanDev, msg: "You're leaning to the side. Center your weight." },
           { type: 'desk', val: deskDevLeft, msg: "You're consistently looking right. Center your primary monitor." },
           { type: 'desk', val: deskDevRight, msg: "You're consistently looking left. Center your primary monitor." }
         ]

         let maxDev = deviations[0]
         for (const dev of deviations) {
           if (dev.val > maxDev.val) maxDev = dev
         }

         percentage = Math.round(maxDev.val)

         if (percentage > settingsRef.current.deviationThreshold) {
           currentFeedback = maxDev.msg
           badType = maxDev.type === 'desk' ? 'leaning' : maxDev.type as any
         }
      } else {
         // Fallback for old baselines without extended data
         percentage = Math.round(slouchDev)
         if (percentage > settingsRef.current.deviationThreshold) {
            currentFeedback = "Your neck is straining forward. Pull your chin back."
            badType = 'slouch'
         }
      }

      setSlouchPercent(Math.max(0, percentage))
      
      if (currentFeedback !== lastFeedbackRef.current) {
        lastFeedbackRef.current = currentFeedback
        setFeedback(currentFeedback)
      }

      const now = Date.now()
      const elapsed = (now - lastTickRef.current) / 1000
      lastTickRef.current = now

      const { deviationThreshold, slouchSeconds, cooldownSeconds } = settingsRef.current

      window.electronAPI?.postureUpdate({ 
        percent: (isMonitoring && !isFocusMode) ? Math.max(0, percentage) : -1, 
        deviationThreshold, 
        slouchSeconds, 
        cooldownSeconds,
        feedback: currentFeedback
      })

      if (percentage > deviationThreshold) {
        setStats(s => {
          const newCauses = { ...s.causes }
          if (badType) newCauses[badType] += elapsed
          return { ...s, badSeconds: s.badSeconds + elapsed, causes: newCauses }
        })
        setStatus('bad')
        // Log bad posture event
        onBadPostureEventRef.current?.()
      } else {
        slouchBufferRef.current = 0
        // Auto-restore brightness as soon as posture is good again
        if (isDimmedRef.current) {
          window.electronAPI?.restoreBrightness()
          isDimmedRef.current = false
        }
        setStatus('good')
      }
    } else {
      setLandmarks(null)
    }

    // Schedule the next frame (this is what makes it a continuous loop)
    rafRef.current = requestAnimationFrame(detectPosture)
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const video = videoRef.current
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
  }, [])

  // ─── Step 3: Start/stop camera and detection loop ───────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })

      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve()
        })
        await video.play()
        rafRef.current = requestAnimationFrame(detectPosture)
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      setStatus('error')
    }
  }, [detectPosture])

  // ─── Step 4: Calibration ────────────────────────────────────────────────────
  // Called when user clicks "Calibrate" — captures current pose as the ideal.
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
    const shoulderY =
      (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2
    const gap = shoulderY - noseY
    const shoulderWidth = Math.abs(lm[RIGHT_SHOULDER].x - lm[LEFT_SHOULDER].x)
    const noseXDeviation = lm[NOSE].x - (lm[LEFT_SHOULDER].x + lm[RIGHT_SHOULDER].x) / 2
    const shoulderTilt = lm[LEFT_SHOULDER].y - lm[RIGHT_SHOULDER].y

    const newBaseline: Baseline = { noseY, shoulderY, gap, shoulderWidth, noseXDeviation, shoulderTilt }
    setBaseline(newBaseline)

    // Save to localStorage so calibration persists across sessions
    localStorage.setItem('ergovision-baseline', JSON.stringify(newBaseline))
    setStatus('good')
    return newBaseline
  }, [])

  const resetStats = useCallback(() => {
    setStats({ 
      goodSeconds: 0, badSeconds: 0, alertCount: 0,
      causes: { slouch: 0, leaning: 0, shoulder: 0, close: 0 }
    })
  }, [])

  const dismissBreak = useCallback(() => {
    setNeedsBreak(false)
    sittingStartRef.current = Date.now() // reset so next reminder is relative to now
  }, [])

  const toggleMonitoring = useCallback(() => {
    const next = !isMonitoringRef.current
    isMonitoringRef.current = next
    setIsMonitoring(next)

    if (!next) {
      stopCamera()
      setSlouchPercent(0)
      setLandmarks(null)
      setStatus('paused')
      setNeedsBreak(false)
      window.electronAPI?.postureUpdate({ percent: -1, deviationThreshold: 0, slouchSeconds: 0, cooldownSeconds: 0 })
    } else {
      lastTickRef.current = Date.now()
      sittingStartRef.current = Date.now() // reset sitting timer when monitoring resumes
      breakCooldownUntilRef.current = 0
      setStatus('uncalibrated')
      startCamera()
    }
  }, [baseline, startCamera, stopCamera])

  useEffect(() => {
    const saved = localStorage.getItem('ergovision-baseline')
    if (saved) setBaseline(JSON.parse(saved))
  }, [])

  // Cleanup: cancel animation frame when component unmounts
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return {
    videoRef,
    status,
    baseline,
    slouchPercent,
    feedback,
    landmarks,
    stats,
    isMonitoring,
    needsBreak,
    startCamera,
    calibrate,
    resetStats,
    toggleMonitoring,
    dismissBreak,
    setOnBadPostureEvent,
  }
}