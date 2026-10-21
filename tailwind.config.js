/** @type {import('tailwindcss').Config} */
// Palette: vermilion #E43D12, rose #D6536D, pink #FFA2B6, sun #EFB11D, cream #EBE9E1.
// `brand` is built around the vermilion; 700 is the shade used for text and buttons because it
// passes contrast on cream and white. `slate` is overridden with warm neutrals that sit on cream,
// so every existing slate-* class picks up the new look.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1eb',
          100: '#ffe3d8',
          200: '#ffc9b5',
          300: '#f9a283',
          400: '#ef6c43',
          500: '#e43d12',
          600: '#d6390f',
          700: '#c2340e',
          800: '#9e2a0b',
          900: '#5a1a08',
          950: '#3a1005',
        },
        rose: { DEFAULT: '#d6536d', dark: '#b23a53' },
        pink: { DEFAULT: '#ffa2b6', light: '#ffd3dd' },
        sun: { DEFAULT: '#efb11d', light: '#f8dc93' },
        cream: { DEFAULT: '#ebe9e1', light: '#f6f4ee' },
        ink: '#2a1610',
        slate: {
          50: '#ebe9e1',
          100: '#e2ded3',
          200: '#d6d1c4',
          300: '#bdb6a6',
          400: '#948c7c',
          500: '#6b6355',
          600: '#554d42',
          700: '#423b33',
          800: '#2e2822',
          900: '#1f1a16',
          950: '#14100d',
        },
      },
    },
  },
  plugins: [],
};
