import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mkcert(), tailwindcss()],
  test: {
    // Enable global variables like 'describe', 'it', and 'expect' so we don't have to import them manually in every single test file.
    globals: true,
    // Simulate a browser environment inside Node terminal using jsdom.
    environment: "jsdom",
    // Automatically run this setup file before every test execution to load the custom DOM matchers.
    setupFiles: "./src/test/setup.ts",
  },
  server: {
    https: true,
  },
});
