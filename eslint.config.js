import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierPluginRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierPluginRecommended,
  {
    ignores: [
      "dist",
      "dist-ssr",
      "node_modules",
      "src-tauri/target",
      "coverage",
      "eslint.config.js",
      "vite.config.ts",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
);
