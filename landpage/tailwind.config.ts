import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: {
          500: "#2f80ed",
          600: "#1f6fdd",
          700: "#1757b8",
        },
      },
    },
  },
};

export default config;
