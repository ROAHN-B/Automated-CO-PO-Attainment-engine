/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ────────────────────────────────────────────────────────
        // A white, editorial canvas in the manner of a financial-institution
        // corporate site: pure white pages, black type, hairline greys. Depth
        // comes from rules and whitespace, not from tinted backgrounds.
        paper: '#FFFFFF',        // app background
        'paper-deep': '#F6F5F3', // recessed surfaces — table heads, inputs at rest, hover rows
        surface: '#FFFFFF',      // cards
        line: '#E2E0DC',         // hairline borders
        'line-soft': '#EEECE9',  // faintest dividers

        // ── Text ramp (neutral, contrast measured on white) ─────────────────
        ink: {
          DEFAULT: '#0B0B0C',   // headings + primary text — 19.6:1
          soft: '#3B3B3D',      // secondary text — 11.0:1
          muted: '#6A6A6D',     // captions / units — 5.3:1, AA
          faint: '#A6A5A3',     // ~2.5:1 — DECORATIVE ONLY, never text
        },

        // ── Accent: BRONZE ───────────────────────────────────────────────────
        // Used sparingly — kickers, step numerals, inline links, active-nav rule,
        // the top gradient bar. Never as a large fill.
        brand: {
          DEFAULT: '#8F5A39',   // = 600 — 6.1:1 on white, safe for small text
          50: '#FAF5F1',
          100: '#F1E5DC',
          200: '#E2CAB8',
          300: '#CBA389',
          400: '#B07E5E',
          500: '#9C6847',
          600: '#8F5A39',
          700: '#7A4A2D',
          800: '#6F3D1E',       // deepest stop of the top bar gradient
          900: '#4D2913',
        },

        // ── Action: SKY ──────────────────────────────────────────────────────
        // Primary buttons only — a pale pill with black text. Black text on it
        // is 13.4:1, so the button stays AA at any size.
        sky: {
          DEFAULT: '#A6D7F0',
          50: '#F1F8FD',
          100: '#DDEFF9',
          200: '#C4E4F5',
          600: '#5FAFD9',
        },

        // "AI" surfaces (RAG/LLM) — aliased onto the bronze accent. Generative
        // features get no hue of their own; they are marked by iconography and
        // a quiet label. Kept so every bg-ai-*/text-ai-*/chip-ai class resolves.
        ai: {
          DEFAULT: '#8F5A39',
          50: '#FAF5F1',
          100: '#F1E5DC',
          600: '#8F5A39',
          700: '#7A4A2D',
        },

        // ── Semantic attainment levels ──────────────────────────────────────
        // Used ONLY for CO/PO attainment data, never for chrome. All ≥4.5:1 on white.
        met: { DEFAULT: '#1D7046', 50: '#EAF4EE' },      // Level 3 / met
        partial: { DEFAULT: '#A05A06', 50: '#FBF1E4' },  // Level 2 / partial
        gap: { DEFAULT: '#B0262E', 50: '#FBECEC' },      // Level 1 / gap
      },
      fontFamily: {
        // UI voice: a neutral grotesk with slightly tight tracking.
        display: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Display serif, set LIGHT (300) — page titles, big figures and step
        // numerals. This light editorial serif is what makes the app read as an
        // institutional record rather than a SaaS dashboard.
        serif: ['Newsreader', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // Nearly flat. Separation is carried by hairlines; shadows only for
        // things that genuinely float (menus, dialogs).
        card: '0 1px 0 rgba(11,11,12,0.03)',
        lift: '0 10px 30px rgba(11,11,12,0.08)',
        pop: '0 24px 64px rgba(11,11,12,0.16)',
        focus: '0 0 0 3px rgba(166,215,240,0.75)',
        plate: 'none',
      },
      borderRadius: {
        // Squarer containers; pills are reserved for buttons and chips.
        xl2: '8px',
        xl3: '10px',
      },
      backgroundImage: {
        // The thin bronze bar that runs across the top of every page.
        'bronze-bar': 'linear-gradient(266deg, #6F3D1E 39%, #A36848 63%, #6F3D1E 91%)',
      },
      transitionTimingFunction: {
        // One curve for everything that moves: fast start, long gentle settle.
        smooth: 'cubic-bezier(0.22,1,0.36,1)',
      },
      transitionDuration: {
        // Motion scale — micro (hover/press), base (panels), slow (page enter).
        micro: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Page/section entrance. Small travel, no scale — content settles rather than pops.
        enter: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Drawer/popover reveal from the left edge.
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'bar-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(320%)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.32s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'scale-in': 'scale-in 0.26s cubic-bezier(0.22,1,0.36,1) both',
        enter: 'enter 0.32s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in': 'slide-in 0.24s cubic-bezier(0.22,1,0.36,1) both',
        'bar-indeterminate': 'bar-indeterminate 1.15s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
