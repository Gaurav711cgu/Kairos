/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          950: '#06090e',
          900: '#0b0f17',
          850: '#111722',
          800: '#161f2e',
          700: '#222f46',
          600: '#334460',
          500: '#4b6185',
          400: '#738cb2',
          300: '#a3b8d6',
          100: '#e1eaf7',
        },
        crimson: {
          500: '#ef4444',
          600: '#dc2626',
          900: '#450a0a',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          900: '#451a03',
        },
        radar: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          900: '#064e3b',
        },
        telemetry: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#082f49',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'sweep 4s linear infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
