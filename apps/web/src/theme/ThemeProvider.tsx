import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ThemeContext, type ThemeName } from "./useTheme";

const STORAGE_KEY = "grottechug-theme";
const DEFAULT_THEME: ThemeName = "grotta";

function isThemeName(value: string | null): value is ThemeName {
  return value === "grotta" || value === "skifer" || value === "lys";
}

function resolveInitialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  let savedTheme: string | null = null;

  try {
    savedTheme = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    savedTheme = null;
  }

  const theme = isThemeName(savedTheme) ? savedTheme : DEFAULT_THEME;

  document.documentElement.dataset.theme = theme;
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Ignore storage failures and keep the in-memory theme. */
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
