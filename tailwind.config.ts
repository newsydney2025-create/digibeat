import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'neon-cyan': '#00f3ff',
                'neon-pink': '#bc13fe',
                'neon-yellow': '#fdd835',
                'neon-green': '#0aff60',
                'bg-deep': '#030304',
                'panel-bg': 'rgba(12, 12, 16, 0.9)',
                'border-glass': 'rgba(255, 255, 255, 0.08)',
            },
            fontFamily: {
                landing: ['Outfit', 'sans-serif'],
                dash: ['Rajdhani', 'sans-serif'],
                mono: ['Space Mono', 'monospace'],
            },
            animation: {
                'spin-slow': 'spin 20s linear infinite',
                'reverse-spin': 'reverse-spin 15s linear infinite',
                'glitch': 'glitch 5s infinite linear alternate-reverse',
                'glitch2': 'glitch2 5s infinite linear alternate-reverse',
                'load-progress': 'load-progress 1.5s ease-in-out forwards',
            },
            keyframes: {
                'reverse-spin': {
                    from: { transform: 'translate(-50%, -50%) rotate(360deg)' },
                    to: { transform: 'translate(-50%, -50%) rotate(0deg)' },
                },
                glitch: {
                    '0%': { clipPath: 'inset(31px 0 94px 0)' },
                    '100%': { clipPath: 'inset(61px 0 66px 0)' },
                },
                glitch2: {
                    '0%': { clipPath: 'inset(60px 0 16px 0)' },
                    '100%': { clipPath: 'inset(87px 0 96px 0)' },
                },
                'load-progress': {
                    '0%': { width: '0%' },
                    '100%': { width: '100%' },
                },
            },
        },
    },
    plugins: [],
}
export default config
