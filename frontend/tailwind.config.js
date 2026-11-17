/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f2f8f4',
          100: '#e1efe5',
          200: '#c5e0cf',
          300: '#9acbb1',
          400: '#69b08d',
          500: '#43956f',
          600: '#327757',
          700: '#285f46',
          800: '#224c3a',
          900: '#0f291e',
          950: '#071810',
        },
        sage: {
          50: '#f6f8f6',
          100: '#e9eee9',
          200: '#d5dfd5',
          300: '#b6c8b7',
          400: '#93ac95',
          500: '#759178',
          600: '#5c745f',
          700: '#4a5d4d',
          800: '#3d4c3f',
          900: '#333f35',
        },
        cream: {
          50: '#fdfcf9',
          100: '#fbf8ee',
          200: '#f5efe0',
          300: '#ebe1cb',
          400: '#ded0b0',
          500: '#cfbc94',
        },
        charcoal: {
          700: '#2b342e',
          800: '#1c2420',
          900: '#121714',
          950: '#0a0d0b',
        },
        earth: {
          500: '#b45309',
          600: '#92400e',
          700: '#78350f',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
      },
      fontFamily: {
        sans: ['Hind Siliguri', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Hind Siliguri', 'Outfit', 'Plus Jakarta Sans', 'sans-serif'],
        bengali: ['Hind Siliguri', 'SolaimanLipi', 'Kalpurush', 'system-ui', 'sans-serif'],
        english: ['Plus Jakarta Sans', 'Outfit', 'Inter', 'sans-serif'],
      },
      keyframes: {
        'sprout-grow': {
          '0%': { transform: 'scale(0.8) translateY(12px)', opacity: '0' },
          '60%': { transform: 'scale(1.05) translateY(-2px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.98)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'subtle-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'sprout-grow': 'sprout-grow 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'subtle-float': 'subtle-float 4s ease-in-out infinite',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(10, 47, 29, 0.08)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-sm': '0 0 20px -5px rgba(67, 149, 111, 0.3)',
        'glow': '0 0 35px -5px rgba(67, 149, 111, 0.4)',
        'glow-lg': '0 0 50px -10px rgba(67, 149, 111, 0.5)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'subtle-grid': 'radial-gradient(circle, rgba(67, 149, 111, 0.08) 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
}
