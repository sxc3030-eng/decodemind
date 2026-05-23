import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Placeholder DecodeMind palette — finalize before V1 design pass
        brand: {
          primary: '#2563EB',   // Blue 600 — trust + tech
          surface: '#0F172A',   // Slate 900 — dark UI
          card: '#1E293B',      // Slate 800
          accent: '#10B981',    // Emerald 500 — success / scans clean
          danger: '#EF4444',    // Red 500 — critical findings
          warn: '#F59E0B',      // Amber 500 — important findings
          muted: '#94A3B8',     // Slate 400
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
