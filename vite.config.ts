import { defineConfig } from "vite";

// GitHub Pages serves project sites from /<repo>/, so every emitted asset URL
// needs that prefix. Override with BASE_PATH=/ for a root-domain deploy.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/minesweeper-console-typescript/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
