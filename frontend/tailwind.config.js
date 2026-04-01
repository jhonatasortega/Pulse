/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pulse: {
          bg: '#0f1117',
          surface: '#1a1d27',
          border: '#2a2d3e',
          accent: '#6366f1',
          'accent-hover': '#4f46e5',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
}
