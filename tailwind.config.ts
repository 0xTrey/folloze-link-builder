import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        folloze: {
          navy: "#081C3A",
          blue: "#0077FF",
          cobalt: "#005BD1",
          violet: "#5E5BFF",
          sky: "#EAF4FF",
          mist: "#F6FAFF",
          border: "#D7E7FF",
          ink: "#5A6985",
        },
      },
      fontFamily: {
        sans: ["var(--font-open-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 28px 80px -48px rgba(8, 28, 58, 0.35)",
        glow: "0 22px 60px -34px rgba(0, 119, 255, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
