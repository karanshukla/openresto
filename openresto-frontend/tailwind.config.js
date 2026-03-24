/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./context/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0a7ea4",
          dark: "#085f7a",
          light: "#0c96c4",
        },
        muted: {
          light: "#6b7280",
          dark: "#9ca3af",
        },
        surface: {
          light: "#ffffff",
          dark: "#1e2022",
        },
        page: {
          light: "#f2f3f5",
          dark: "#111214",
        },
        card: {
          light: "#ffffff",
          dark: "#282d33",
        },
        border: {
          light: "rgba(0,0,0,0.12)",
          dark: "rgba(255,255,255,0.12)",
        },
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
