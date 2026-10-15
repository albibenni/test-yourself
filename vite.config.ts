/// <reference types="vite-plus/test" />

import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { defineConfig, lazyPlugins } from "vite-plus";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  check: {
    fmt: true,
    lint: true,
  },
  fmt: {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    singleQuote: false,
    jsxSingleQuote: false,
    semi: true,
    trailingComma: "all",
    quoteProps: "as-needed",
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    sortImports: true,
    ignorePatterns: [
      "coverage/**",
      ".github/**",
      "pnpm-lock.yaml",
      "**/*.md",
      "src-tauri/target/**",
      "src-tauri/gen/**",
      "src-tauri/test_data/**",
      "aur/**",
    ],
  },
  lint: {
    plugins: ["unicorn", "typescript", "oxc", "react", "import"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    ignorePatterns: ["dist/**", "coverage/**", "src-tauri/**", "aur/**"],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-namespace": "error",
      "import/no-commonjs": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "warn",
      "react/jsx-key": "error",
      "react/no-children-prop": "error",
      "react/no-danger-with-children": "error",
      "react/immutability": "off",
      "react/purity": "off",
      "react/set-state-in-effect": "off",
      "no-debugger": "error",
      "no-async-promise-executor": "error",
      "prefer-const": "error",
      "no-var": "error",
      "no-unused-expressions": "off",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  base: "./",
  plugins: lazyPlugins(() => [react(), cssInjectedByJsPlugin()]),
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "tauri",
              test: /node_modules[\\/]@tauri-apps[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/](?:react|react-dom|zod|clsx)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
    rollupOptions: {
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
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/aur/**"],
  },
}));
