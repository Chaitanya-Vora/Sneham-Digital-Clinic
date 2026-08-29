/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sneham palette — pulled from the design system
        canvas: '#EFEDE4',
        screen: '#F4F2EA',
        raised: '#F7F5EC',
        surface: '#FCFBF6',
        'surface-hover': '#FFFEFA',
        ink: '#232A1E',
        'ink-deep': '#2F4A2B',
        body: '#3F4738',
        'body-mid': '#5F6957',
        muted: '#6C7362',
        faint: '#8C9280',
        // greens
        brand: '#41603C',
        accent: '#7A9B66',
        'accent-deep': '#5A7C4E',
        success: '#5E8A57',
        tint: '#DCE6D0',
        'tint-pale': '#E9EEE1',
        'green-border': '#B9CDA8',
        // borders / lines
        border: '#E1E3D6',
        'border-dash': '#D6D9C8',
        // amber
        amber: '#D8A24A',
        'amber-tint': '#F7EEDC',
        'amber-border': '#EBD6AE',
        'amber-text': '#8A6320',
        // danger
        danger: '#B85A45',
        // handoff purple
        purple: '#5C4A66',
        'purple-tint': '#EDE7F0',
        'purple-border': '#DED4E3',
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      // A real type scale, so new screens have one to reach for instead of
      // inventing another one-off text-[Npx]. Names are chosen to avoid any
      // collision with the color tokens above — text-body/text-ink/etc.
      // already mean a color, and fontSize and color share the `text-*`
      // utility namespace in Tailwind.
      fontSize: {
        hero: ['28px', { lineHeight: '1.15' }],
        h1: ['22px', { lineHeight: '1.2' }],
        h2: ['18px', { lineHeight: '1.3' }],
        h3: ['15px', { lineHeight: '1.4' }],
        paragraph: ['14px', { lineHeight: '1.5' }],
        small: ['13px', { lineHeight: '1.5' }],
        label: ['12px', { lineHeight: '1.4' }],
        micro: ['11px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        pill: '999px',
      },
      boxShadow: {
        card: '0 6px 16px rgba(65,96,60,0.05)',
        'card-lg': '0 14px 32px rgba(65,96,60,0.10)',
        float: '0 10px 26px rgba(65,96,60,0.20)',
        cta: '0 12px 30px rgba(65,96,60,0.24)',
        modal: '0 24px 60px rgba(35,42,30,0.24)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(18px)' }, to: { opacity: '1', transform: 'none' } },
        riseSm: { from: { opacity: '0', transform: 'translateY(9px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        dropIn: { from: { opacity: '0', transform: 'translateY(-16px) scale(.97)' }, to: { opacity: '1', transform: 'none' } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: '.9' }, '50%': { transform: 'scale(1.06)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.22,.61,.36,1) both',
        riseSm: 'riseSm .4s cubic-bezier(.22,.61,.36,1) both',
        fade: 'fade .4s ease both',
        dropIn: 'dropIn .38s cubic-bezier(.22,.61,.36,1) both',
        breathe: 'breathe 2.4s ease-in-out infinite',
        pop: 'pop .42s cubic-bezier(.34,1.56,.64,1) both',
      },
    },
  },
  plugins: [],
}
