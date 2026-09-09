/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ────────────────────────────────────────────────────────
        // A WARM CREAM paper system, sampled from the Krishi Mitra reference
        // (#FBF8F3 was the single most common pixel in the recording by a wide
        // margin — it is the aesthetic). Cards sit only a few values lighter
        // than the page and rely on a soft diffuse shadow for separation, which
        // is what produces the calm, uncluttered feel. Resist the urge to
        // "fix" that low contrast with a hard border.
        paper: '#FBF8F3',       // app background — warm cream, hue ~38°
        surface: '#FEFDFA',     // cards — warm near-white, NOT pure #FFF
        line: '#E7E2D8',        // hairline borders — warm, soft, still visible
        'line-soft': '#F1EDE4', // faintest dividers

        // ── Text ramp ───────────────────────────────────────────────────────
        // Near-black GREEN rather than slate. The reference sets headings in a
        // very dark green (~#1F3B1C sampled), which is what keeps the palette
        // organic instead of tech-neutral. Hue held at ~112° to agree with the
        // accent. Contrast measured against paper #FBF8F3, not white.
        ink: {
          DEFAULT: '#1A2C17',   // headings + primary text — 13.99:1 on paper
          soft: '#394A36',      // secondary text — 8.98:1
          muted: '#687566',     // captions / units — 4.58:1, still AA
          faint: '#9AA396',     // ~2.6:1 — DECORATIVE ONLY, never text
        },

        // ── Primary brand: DEEP FOREST GREEN ────────────────────────────────
        // Sampled from the reference's icon plates (#256A1B / #2C7023). Note
        // this is a LEAF green at hue ~112°, deliberately NOT Tailwind emerald
        // (emerald-600 sits at ~162°, which is visibly teal and reads cold).
        // The whole ramp is generated at a locked 112° so tints never go muddy
        // or drift minty.
        brand: {
          DEFAULT: '#266A1B',   // = 700
          50: '#F0F7EF',        // faintest wash
          100: '#DBEBD9',       // pale chips, soft badges, icon-chip backgrounds
          200: '#BDDAB8',
          300: '#94C48D',       // hover borders
          400: '#66A55C',
          500: '#418A36',       // 4.03:1 on paper — LARGE TEXT / NON-TEXT ONLY
          600: '#2D7522',       // 5.39:1 — safe for small text
          700: '#266A1B',       // 6.28:1 — the workhorse; white on it is 6.64:1
          800: '#1E5416',       // primary-button hover
          900: '#173F11',
        },

        // "AI" surfaces (RAG/LLM) — aliased ONTO the forest ramp. Generative
        // features get no hue of their own; they are marked by iconography and
        // a quiet label. Kept as an alias rather than deleted so every existing
        // bg-ai-*/text-ai-*/chip-ai/btn-ai class keeps resolving.
        ai: {
          DEFAULT: '#2D7522',
          50: '#F0F7EF',
          100: '#DBEBD9',
          600: '#2D7522',
          700: '#266A1B',
        },

        // ── Semantic attainment levels ──────────────────────────────────────
        // Used ONLY for CO/PO attainment data, never for chrome. `met` is
        // pushed to an emerald-leaning 146° so it stays legible as a distinct
        // signal next to the 112° brand green — the two must not be confusable
        // when a level meter sits beside a brand plate. All ≥4.5:1 on paper.
        met: { DEFAULT: '#1B7A45', 50: '#E8F3EC' },      // Level 3 / met  — 5.06:1
        partial: { DEFAULT: '#9C5A08', 50: '#FAF0E2' },  // Level 2 / partial — 5.11:1
        gap: { DEFAULT: '#A8102F', 50: '#FBEAEC' },      // Level 1 / gap — 7.13:1
      },
      fontFamily: {
        // ONE geometric voice, as in the reference — headings and body are
        // visibly the same family there, with hierarchy carried by weight and
        // size rather than by a second typeface. Plus Jakarta Sans is friendly
        // and round enough to feel organic while staying professional at 700+.
        // (Space Grotesk was retired: its quirky apertures read "tech startup",
        // which is the opposite of calm.) Mono is a utility face reserved for
        // DATA — codes like CO1/PO2, percentages, timestamps — never for
        // decorative uppercase eyebrows.
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // Soft and DIFFUSE, the reference's signature elevation. Shadow colour
        // is the dark green ink — a black shadow over warm cream goes grey and
        // instantly cheapens the card.
        card: '0 1px 2px rgba(26,44,23,0.04), 0 2px 8px rgba(26,44,23,0.05)',
        lift: '0 2px 6px rgba(26,44,23,0.05), 0 12px 28px rgba(26,44,23,0.10)',
        pop: '0 18px 48px rgba(26,44,23,0.13)',
        focus: '0 0 0 4px rgba(38,106,27,0.18)',
        // For the solid green icon plates. Tinted with the brand green rather
        // than neutral ink so the plate glows into the cream instead of
        // punching a grey hole in it.
        plate: '0 1px 3px rgba(26,44,23,0.14), 0 6px 16px rgba(38,106,27,0.18)',
      },
      borderRadius: {
        // Widened from 14/20px. The reference leans generously round; this is
        // what "soft, breathable container" means in practice.
        xl2: '18px',
        xl3: '24px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
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
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'scale-in': 'scale-in 0.34s cubic-bezier(0.16,1,0.3,1) both',
        'bar-indeterminate': 'bar-indeterminate 1.15s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
