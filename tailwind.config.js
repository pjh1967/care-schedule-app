/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // saesun-care-schedule 디자인 가이드의 emerald 포인트 컬러
        brand: {
          50: "#ecfdf5",
          200: "#a7f3d0",
          700: "#047857",
          800: "#065f46",
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', '"Malgun Gothic"', 'sans-serif'],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        xl: "12px",
      },
    },
  },
  plugins: [],
};
