/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14211d",
        muted: "#5b6b62",
        panel: "#ffffff",
        accent: "#0e5a4b",
        sand: "#f4f1ea",
        primary: "#0e5a4b"
      }
    }
  },
  plugins: []
};
