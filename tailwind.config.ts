import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ally: "#2563eb",
        enemy: "#dc2626",
      },
    },
  },
  plugins: [],
};

export default config;
