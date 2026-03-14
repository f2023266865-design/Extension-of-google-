import type { Config } from 'tailwindcss';

export default {
  content: ['./popup/index.html', './popup/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glass: '0 24px 80px rgba(10, 18, 40, 0.32)'
      },
      colors: {
        primary: '#5b5df1',
        'background-dark': '#101122',
        'background-light': '#f6f6f8',
        ink: '#0a1020',
        mist: '#eef4ff',
        coral: '#ff7a59',
        lagoon: '#1f7ae0',
        mint: '#70d6c8'
      },
      fontFamily: {
        display: ['Inter', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        aura: 'radial-gradient(circle at top left, rgba(112, 214, 200, 0.45), transparent 45%), radial-gradient(circle at top right, rgba(31, 122, 224, 0.35), transparent 40%), linear-gradient(180deg, rgba(255,255,255,0.72), rgba(232,240,255,0.42))'
      }
    }
  },
  plugins: []
} satisfies Config;