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
        castor: {
          black: '#000000',
          dark: '#1a1a1a',
          gray: '#4a4a4a',
          light: '#e5e5e5',
          white: '#ffffff',
          brand: '#AE997A',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['"Special Gothic Expanded One"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
