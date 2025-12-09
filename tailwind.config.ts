import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'hera-crimson': '#FF0066',
        'hera-void': '#0F172A',
        'hera-gold': '#F59E0B',
        'hera-ice': '#E0F2FE',
        'hera-slate': '#1E293B',
      },
      animation: {
        'box-breathe': 'boxBreathing 16s infinite ease-in-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'lock-shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
      },
      keyframes: {
        boxBreathing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.3' },
          '25%': { transform: 'scale(1.1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '1' },
          '75%': { transform: 'scale(1)', opacity: '0.3' },
          '95%': { transform: 'scale(1)', opacity: '0.3' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' }
        }
      },
    },
  },
  plugins: [],
};
export default config;
