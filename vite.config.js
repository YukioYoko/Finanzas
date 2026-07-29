import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // La versión (VERSION_NAME) la fija el CI al compilar; en dev queda "dev".
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VERSION_NAME || "dev"),
  },
});
