/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f6f8fb",
        surface: "#ffffff",
        panel: "#ffffff",
        ink: "#101828",
        muted: "#667085",
        accent: "#2563eb",
        accentSoft: "#e8efff",
        line: "#e4e7ec",
        success: "#12b76a",
        warning: "#f79009",
        danger: "#f04438",
      },
      boxShadow: {
        card: "0 14px 32px -24px rgba(16, 24, 40, 0.18), 0 3px 10px rgba(16, 24, 40, 0.04)",
      },
    },
  },
  plugins: [],
};
