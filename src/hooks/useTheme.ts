import { load } from "@tauri-apps/plugin-store";
import { useEffect, useState } from "react";
import { STORE_FILENAME } from "../constants";
import type {
  AccentColor,
  ContrastPreference,
  ReducedMotionPreference,
  TextColor,
  TextScale,
  ThemeType as Theme,
} from "../types";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState<AccentColor>("blue");
  const [textColor, setTextColor] = useState<TextColor>("slate");
  const [textScale, setTextScale] = useState<TextScale>("default");
  const [contrast, setContrast] = useState<ContrastPreference>("system");
  const [reducedMotion, setReducedMotion] =
    useState<ReducedMotionPreference>("system");

  useEffect(() => {
    async function loadSettings() {
      try {
        const store = await load(STORE_FILENAME, {
          autoSave: false,
          defaults: {},
        });
        const storedTheme = (await store.get<Theme>("app_theme")) || "system";
        const storedAccent =
          (await store.get<AccentColor>("app_accent")) || "blue";
        const storedTextColor =
          (await store.get<TextColor>("app_text_color")) || "slate";
        const storedTextScale =
          (await store.get<TextScale>("app_text_scale")) || "default";
        const storedContrast =
          (await store.get<ContrastPreference>("app_contrast")) || "system";
        const storedReducedMotion =
          (await store.get<ReducedMotionPreference>("app_reduced_motion")) ||
          "system";
        setTheme(storedTheme);
        setAccent(storedAccent);
        setTextColor(storedTextColor);
        setTextScale(storedTextScale);
        setContrast(storedContrast);
        setReducedMotion(storedReducedMotion);
      } catch (e) {
        console.warn("Could not load theme settings", e);
      }
    }
    void loadSettings();
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = theme;
      if (theme === "system") {
        activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      document.documentElement.setAttribute("data-theme", activeTheme);
      document.documentElement.setAttribute("data-accent", accent);
      document.documentElement.setAttribute("data-text-color", textColor);
      document.documentElement.setAttribute("data-text-scale", textScale);
      document.documentElement.setAttribute("data-contrast", contrast);
      document.documentElement.setAttribute(
        "data-reduced-motion",
        reducedMotion,
      );
    };

    applyTheme();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme, accent, contrast, reducedMotion, textColor, textScale]);

  const saveTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      const store = await load(STORE_FILENAME, {
        autoSave: false,
        defaults: {},
      });
      await store.set("app_theme", newTheme);
      await store.save();
    } catch (e) {
      console.warn("Failed to save theme", e);
    }
  };

  const saveAccent = async (newAccent: AccentColor) => {
    setAccent(newAccent);
    try {
      const store = await load(STORE_FILENAME, {
        autoSave: false,
        defaults: {},
      });
      await store.set("app_accent", newAccent);
      await store.save();
    } catch (e) {
      console.warn("Failed to save accent", e);
    }
  };

  const saveTextColor = async (newTextColor: TextColor) => {
    setTextColor(newTextColor);
    try {
      const store = await load(STORE_FILENAME, {
        autoSave: false,
        defaults: {},
      });
      await store.set("app_text_color", newTextColor);
      await store.save();
    } catch (e) {
      console.warn("Failed to save text color", e);
    }
  };

  const saveTextScale = async (newTextScale: TextScale) => {
    setTextScale(newTextScale);
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    await store.set("app_text_scale", newTextScale);
    await store.save();
  };

  const saveContrast = async (newContrast: ContrastPreference) => {
    setContrast(newContrast);
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    await store.set("app_contrast", newContrast);
    await store.save();
  };

  const saveReducedMotion = async (
    newReducedMotion: ReducedMotionPreference,
  ) => {
    setReducedMotion(newReducedMotion);
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    await store.set("app_reduced_motion", newReducedMotion);
    await store.save();
  };

  return {
    theme,
    accent,
    textColor,
    textScale,
    contrast,
    reducedMotion,
    saveTheme,
    saveAccent,
    saveTextColor,
    saveTextScale,
    saveContrast,
    saveReducedMotion,
  };
}
