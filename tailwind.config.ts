import type { Config } from "tailwindcss";

// Warna dari CSS variables (channel RGB) + <alpha-value> → opacity modifier tetap jalan.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palet baru (planning-update-2): token lama dialias → theme-aware.
        white: v("surface"),
        dominant: v("dominant"),
        secondary: v("secondary"),
        accent: v("accent"),
        "secondary-fixed": v("secondary-fixed"),
        "accent-fixed": v("accent-fixed"),
        sidebar: {
          fg: v("sidebar-fg"),
          muted: v("sidebar-muted"),
          border: "rgb(var(--sidebar-border) / var(--sidebar-border-opacity, 1))",
          active: "rgb(var(--sidebar-active-bg) / var(--sidebar-active-bg-opacity, 0.1))",
          hover: "rgb(var(--sidebar-hover-bg) / var(--sidebar-hover-bg-opacity, 0.05))",
          dot: v("sidebar-accent-dot"),
        },
        surface: { DEFAULT: v("surface"), 2: v("surface-2") },
        border: v("border"),
        light: { DEFAULT: v("light"), muted: v("light-muted") },
        mint: v("mint"),
        brand: {
          50: v("brand-50"),
          100: v("brand-100"),
          200: v("brand-200"),
          300: v("brand-300"),
          400: v("brand-400"),
          500: v("brand-500"),
          600: v("brand-600"),
          700: v("brand-700"),
          800: v("brand-800"),
          900: v("brand-900"),
          950: v("brand-950"),
        },
        slate: {
          50: v("slate-50"),
          100: v("slate-100"),
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
          700: v("slate-700"),
          800: v("slate-800"),
          900: v("slate-900"),
        },
        ink: {
          700: v("ink-700"),
          800: v("ink-800"),
          900: v("ink-900"),
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px rgb(var(--card-shadow) / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
