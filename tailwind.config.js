/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        good: '#22c55e',
        bad: '#ef4444',
        neutral: '#64748b',
      }
    },
  },
  plugins: [],
}