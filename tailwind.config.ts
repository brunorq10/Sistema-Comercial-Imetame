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
        'green-primary': '#2E7D32',
        'green-dark': '#1B5E20',
        'green-light': '#E8F5E9',
        'green-md': '#43A047',
        'auto-value': '#1565C0',
        'auto-bg': '#EEF7EE',
        future: '#6A1B9A',
        'future-bg': '#F3E5F5',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config