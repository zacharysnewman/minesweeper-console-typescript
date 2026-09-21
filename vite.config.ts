import { defineConfig } from "vite";

// GitHub Pages serves project sites from /<repo>/, so every emitted asset URL
// needs that prefix. Override with BASE_PATH=/ for a root-domain deploy.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/minesweeper-console-typescript/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Two pages off one set of game rules: the board at /, the mining game at
    // /mine/. Rollup keeps each entry's directory, so mine/index.html lands at
    // dist/mine/index.html and the sub path needs no server config.
    rollupOptions: {
      input: {
        main: "index.html",
        mine: "mine/index.html",
      },
    },
  },
});
