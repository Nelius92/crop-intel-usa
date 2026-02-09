/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                corn: {
                    base: '#000000', // Pure Black
                    surface: '#120202', // Very Dark Red/Black
                    accent: '#ef4444', // Red 500
                    glow: '#f87171', // Red 400
                    high: '#84cc16', // Lime 500 (Keep for positive indicators)
                    low: '#f97316', // Orange 500
                }
            }
        },
        boxShadow: {
            'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            'neon-red': '0 0 10px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.3)',
            'glow': '0 0 15px rgba(239, 68, 68, 0.3)',
            'depth': '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        },
        animation: {
            'fade-in-up': 'fadeInUp 0.5s ease-out',
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        keyframes: {
            fadeInUp: {
                '0%': { opacity: '0', transform: 'translateY(10px)' },
                '100%': { opacity: '1', transform: 'translateY(0)' },
            }
        },
        fontFamily: {
            sans: ['Inter', 'sans-serif'],
        },
    },
    plugins: [],
}
