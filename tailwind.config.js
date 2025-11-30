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
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
