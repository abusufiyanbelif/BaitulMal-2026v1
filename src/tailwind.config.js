/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        headline: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        code: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
          '6': 'hsl(var(--chart-6))',
          '7': 'hsl(var(--chart-7))',
          '8': 'hsl(var(--chart-8))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in-from-top': {
            '0%': { transform: 'translateY(-20%)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
            '0%': { transform: 'translateY(20%)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in-up': {
            '0%': { opacity: '0', transform: 'translateY(15px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-zoom': {
            '0%': { opacity: '0', transform: 'scale(0.95)' },
            '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'zoom-in-out': {
            '0%, 100%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.05)' },
        },
        'ticker-sequence': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '8%': { transform: 'translateY(0)', opacity: '1' },
          '25%': { transform: 'translateX(0)' },
          '88%': { transform: 'translateX(-100%)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'ticker-fade-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'urgent-pulse': {
          '0%, 100%': { boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)', borderColor: 'hsl(var(--border))' },
          '50%': { boxShadow: '0 0 25px rgba(239, 68, 68, 0.5)', borderColor: 'rgba(239, 68, 68, 0.8)' },
        },
        'high-pulse': {
          '0%, 100%': { boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)', borderColor: 'hsl(var(--border))' },
          '50%': { boxShadow: '0 0 25px rgba(245, 158, 11, 0.4)', borderColor: 'rgba(245, 158, 11, 0.7)' },
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'fade-in-zoom': 'fade-in-zoom 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'shimmer': 'shimmer 2s infinite',
        'zoom-in-out': 'zoom-in-out 3s ease-in-out infinite',
        'ticker-sequence': 'ticker-sequence 8s linear infinite',
        'ticker-fade-pulse': 'ticker-fade-pulse 2s ease-in-out infinite',
        'urgent-pulse': 'urgent-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'high-pulse': 'high-pulse 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

module.exports = config;
