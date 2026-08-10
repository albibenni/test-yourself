/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: "./",
  plugins: [react(), cssInjectedByJsPlugin()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "zod", "clsx"],
          todoist: ["@doist/todoist-sdk"],
          tauri: [
            "@tauri-apps/api",
            "@tauri-apps/plugin-dialog",
            "@tauri-apps/plugin-store",
            "@tauri-apps/plugin-updater",
            "@tauri-apps/plugin-deep-link",
            "@tauri-apps/plugin-process",
            "@tauri-apps/plugin-opener",
            "@tauri-apps/plugin-stronghold",
          ],
        },
      },
      onwarn(warning, warn) {
        if (
          warning.message.includes(
            "has been externalized for browser compatibility",
          )
        )
          return;
        warn(warning);
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: process.env.HMR_PORT
            ? parseInt(process.env.HMR_PORT, 10)
            : 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
  },
}));
