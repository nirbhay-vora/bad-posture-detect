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
  type PoseLandmarkerResult
} from '@mediapipe/tasks-vision'

// Pose landmark indices from MediaPipe's 33-point body model
// Full list: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
const NOSE = 0
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12

// How many consecutive "bad" frames before we alert
const SLOUCH_THRESHOLD = 300 // ~10 seconds at 30fps

// How many frames to wait before allowing another notification
const NOTIFY_COOLDOWN_FRAMES = 300 // ~10 seconds at 30fps

export type PostureStatus = 'loading' | 'uncalibrated' | 'good' | 'bad' | 'error'

export interface Baseline {
  noseY: number
  shoulderY: number
  gap: number        // vertical distance between nose and shoulder
}

export function usePostureEngine() {
  // The actual MediaPipe model instance
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  
  // Reference to the <video> element (set by Dashboard.tsx)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  
  // requestAnimationFrame ID — stored so we can cancel the loop
  const rafRef = useRef<number>(0)
  
  // Counts consecutive bad-posture frames
  const slouchBufferRef = useRef(0)
  const cooldownRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const isDimmedRef = useRef(false) // track whether screen is currently dimmed

  const [status, setStatus] = useState<PostureStatus>('loading')
  const [baseline, setBaseline] = useState<Baseline | null>(null)
  const [slouchPercent, setSlouchPercent] = useState(0)

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
  }, []) // Empty array = run once when component mounts

  // ─── Step 2: The main detection loop ────────────────────────────────────────
  const detectPosture = useCallback(() => {
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

    // Run detection — MediaPipe gives us 33 landmarks for the body
    const result: PoseLandmarkerResult = landmarker.detectForVideo(
      video,
      performance.now()
    )

    // If a person is detected and we have a baseline, analyze posture
    if (result.landmarks.length > 0 && baseline) {
      const landmarks = result.landmarks[0] // First (only) detected person

      const noseY = landmarks[NOSE].y
      const shoulderY =
        (landmarks[LEFT_SHOULDER].y + landmarks[RIGHT_SHOULDER].y) / 2

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
      const deviation = 1 - currentGap / baseline.gap
      const percentage = Math.round(deviation * 100)

      setSlouchPercent(Math.max(0, percentage))

      if (percentage > 20) {
        // ── Anti-Jitter: Slouch Buffer ──────────────────────────────────────
        // We don't alert on a single bad frame.
        // We increment a counter; only alert after 150 consecutive bad frames.
        slouchBufferRef.current += 1

        if (slouchBufferRef.current >= SLOUCH_THRESHOLD && cooldownRef.current === 0) {
          console.warn('🚨 BAD POSTURE detected!')
          window.electronAPI?.dimScreen()
          window.electronAPI?.notify(
            '🧍 ErgoVision Alert',
            'You\'ve been slouching for ~10 seconds. Sit up straight!'
          )
          isDimmedRef.current = true
          cooldownRef.current = NOTIFY_COOLDOWN_FRAMES
          slouchBufferRef.current = 0
        }

        setStatus('bad')
      } else {
        slouchBufferRef.current = 0
        // Auto-restore brightness as soon as posture is good again
        if (isDimmedRef.current) {
          window.electronAPI?.restoreBrightness()
          isDimmedRef.current = false
        }
        setStatus('good')
      }

      // Tick down the notification cooldown each frame
      if (cooldownRef.current > 0) {
        cooldownRef.current -= 1
      }
    }

    // Schedule the next frame (this is what makes it a continuous loop)
    rafRef.current = requestAnimationFrame(detectPosture)
  }, [baseline]) // Re-create this function whenever baseline changes

  // ─── Step 3: Start/stop camera and detection loop ───────────────────────────
  const startCamera = useCallback(async () => {
    try {
      // Request webcam access from the browser
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

    const landmarks = result.landmarks[0]
    const noseY = landmarks[NOSE].y
    const shoulderY =
      (landmarks[LEFT_SHOULDER].y + landmarks[RIGHT_SHOULDER].y) / 2
    const gap = shoulderY - noseY

    const newBaseline: Baseline = { noseY, shoulderY, gap }
    setBaseline(newBaseline)

    // Save to localStorage so calibration persists across sessions
    localStorage.setItem('ergovision-baseline', JSON.stringify(newBaseline))
    setStatus('good')
  }, [])

  // Load saved baseline from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('ergovision-baseline')
    if (saved) {
      setBaseline(JSON.parse(saved))
    }
  }, [])

  // Cleanup: cancel animation frame when component unmounts
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const dismissAlert = useCallback(() => {
    window.electronAPI?.restoreBrightness()
    isDimmedRef.current = false
  }, [])

  return {
    videoRef,
    status,
    baseline,
    slouchPercent,
    startCamera,
    calibrate,
    dismissAlert,
  }
}