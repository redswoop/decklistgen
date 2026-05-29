import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, "../../dist/client"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:  resolve(__dirname, "index.html"),
        lab:   resolve(__dirname, "lab.html"),
        print: resolve(__dirname, "print.html"),
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": "http://localhost:3001",
      "/gallery": "http://localhost:3001",
    },
  },
});
