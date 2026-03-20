import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // ← ADD THIS — Electron loads files with relative paths
  server: {
    port: 5173,
    strictPort: true,
  }
})