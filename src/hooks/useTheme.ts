import { useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";
import { STORE_FILENAME } from "../constants";

export type Theme = "dark" | "light" | "system";
export type AccentColor = "blue" | "purple" | "green" | "deep-green" | "rose" | "orange" | "red-brick";
export type TextColor = "slate" | "zinc" | "neutral" | "stone";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState<AccentColor>("blue");
  const [textColor, setTextColor] = useState<TextColor>("slate");

  useEffect(() => {
    async function loadSettings() {
      const store = await load(STORE_FILENAME, { autoSave: false } as any);
      const storedTheme = await store.get<Theme>("app_theme") || "system";
      const storedAccent = await store.get<AccentColor>("app_accent") || "blue";
      const storedTextColor = await store.get<TextColor>("app_text_color") || "slate";
      setTheme(storedTheme);
      setAccent(storedAccent);
      setTextColor(storedTextColor);
    }
    void loadSettings();
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = theme;
      if (theme === "system") {
        activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", activeTheme);
      document.documentElement.setAttribute("data-accent", accent);
      document.documentElement.setAttribute("data-text-color", textColor);
    };

    applyTheme();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme, accent, textColor]);

  const saveTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
    await store.set("app_theme", newTheme);
    await store.save();
  };

  const saveAccent = async (newAccent: AccentColor) => {
    setAccent(newAccent);
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
    await store.set("app_accent", newAccent);
    await store.save();
  };

  const saveTextColor = async (newTextColor: TextColor) => {
    setTextColor(newTextColor);
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
    await store.set("app_text_color", newTextColor);
    await store.save();
  };

  return { theme, accent, textColor, saveTheme, saveAccent, saveTextColor };
}
