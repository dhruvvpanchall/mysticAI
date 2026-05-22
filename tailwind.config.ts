import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./animations/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Cosmic palette — chat/dark surfaces
        void: "#05030d",
        midnight: "#0a0618",
        nebula: "#13093a",
        indigo: {
          deep: "#1b1240",
          glow: "#3a1f8a",
        },
        cosmic: {
          purple: "#5b2bc7",
          violet: "#7c3aed",
        },
        saffron: {
          DEFAULT: "#f5a623",
          glow: "#ffb547",
          soft: "#ffd089",
          50: "#fff7e6",
          100: "#fde7b9",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f5d76e",
          deep: "#a87c00",
        },
        cyan: {
          aura: "#7ee8fa",
          deep: "#22d3ee",
        },
        aura: {
          divine: "rgba(245, 166, 35, 0.18)",
          cosmic: "rgba(124, 58, 237, 0.22)",
        },
        // Light/warm palette — landing + auth surfaces
        parchment: {
          DEFAULT: "#fbf6ec",       // page background — soft warm cream
          deep: "#f4ead6",          // section alt-bg
          muted: "#ece1c8",          // borders, dividers
        },
        ink: {
          DEFAULT: "#1c1208",       // primary text — warm near-black
          soft: "#3a2a18",          // secondary text
          muted: "#6a5640",          // tertiary text / captions
        },
        maroon: {
          DEFAULT: "#7a1f1f",       // deep accent — Indic warmth
          deep: "#5a1414",
          soft: "#a64545",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "cosmic-radial":
          "radial-gradient(ellipse at top, rgba(124,58,237,0.22), transparent 55%), radial-gradient(ellipse at bottom right, rgba(245,166,35,0.12), transparent 50%), radial-gradient(ellipse at bottom left, rgba(34,211,238,0.08), transparent 55%)",
        "aurora-shift":
          "linear-gradient(120deg, rgba(124,58,237,0.4), rgba(245,166,35,0.3), rgba(34,211,238,0.25), rgba(124,58,237,0.4))",
        "divine-gradient":
            "linear-gradient(135deg, #f5a623 0%, #ffd089 50%, #f5a623 100%)",
        // Warm parchment wash used as the landing-page base
        "parchment-radial":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,166,35,0.18), transparent 60%), radial-gradient(ellipse 60% 40% at 100% 40%, rgba(122,31,31,0.10), transparent 60%), radial-gradient(ellipse 60% 40% at 0% 80%, rgba(245,166,35,0.10), transparent 60%)",
        "saffron-fade":
          "linear-gradient(180deg, #fbf6ec 0%, #f4ead6 100%)",
      },
      boxShadow: {
        divine: "0 0 60px -10px rgba(245, 166, 35, 0.45)",
        cosmic: "0 0 80px -10px rgba(124, 58, 237, 0.55)",
        aura: "0 0 100px -20px rgba(245, 166, 35, 0.6), 0 0 60px -20px rgba(124, 58, 237, 0.4)",
        inset_glow: "inset 0 0 30px rgba(245, 166, 35, 0.18)",
      },
      keyframes: {
        "aurora-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6", filter: "blur(40px)" },
          "50%": { opacity: "1", filter: "blur(60px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "spin-slower": {
          to: { transform: "rotate(-360deg)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        "shimmer-text": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "aurora-pan": "aurora-pan 18s ease-in-out infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
        "pulse-glow": "pulse-glow 6s ease-in-out infinite",
        "spin-slow": "spin-slow 40s linear infinite",
        "spin-slower": "spin-slower 60s linear infinite",
        twinkle: "twinkle 3.5s ease-in-out infinite",
        "shimmer-text": "shimmer-text 6s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
