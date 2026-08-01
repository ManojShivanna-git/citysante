/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea6c0a',700:'#c2570c',800:'#9a3412',900:'#7c2d12' },
        accent: { 300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04' },
      },
    },
  },
  plugins: [],
}
