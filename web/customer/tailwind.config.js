/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d' },
        accent: { 300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04' },
      },
    },
  },
  plugins: [],
}
