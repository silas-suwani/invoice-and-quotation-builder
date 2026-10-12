/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a', muted: '#64748b', border: '#e2e8f0', canvas: '#f8fafc',
        primary: { DEFAULT: '#4f46e5', hover: '#4338ca', soft: '#eef2ff' },
      },
      boxShadow: { card: '0 1px 3px rgba(15,23,42,.05), 0 1px 2px rgba(15,23,42,.03)' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
