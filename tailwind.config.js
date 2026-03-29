/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'salesforce-blue': '#0176D3',
        'salesforce-hover': '#014486',
        'lightning-yellow': '#FFBC1F',
      },
    },
  },
  plugins: [],
} 