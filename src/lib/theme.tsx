'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeId = 'terminal' | 'amber' | 'cyan' | 'copper';

export const THEMES = [
  { id: 'terminal' as const, label: 'Terminal', color: '#22c55e' },
  { id: 'amber' as const, label: 'Amber', color: '#f59e0b' },
  { id: 'cyan' as const, label: 'Cyan', color: '#06b6d4' },
  { id: 'copper' as const, label: 'Copper', color: '#e87b55' },
] as const;

/** Hex accent colors for use in chart libraries (Recharts, lightweight-charts) */
export const ACCENT_HEX: Record<ThemeId, string> = {
  terminal: '#22c55e',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  copper: '#e87b55',
};

/** Secondary comparison color (contrasts with accent) */
export const SECONDARY_HEX: Record<ThemeId, string> = {
  terminal: '#f59e0b',
  amber: '#06b6d4',
  cyan: '#f59e0b',
  copper: '#06b6d4',
};

const STORAGE_KEY = 'vt-theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  accentHex: string;
  secondaryHex: string;
}

const ThemeCtx = createContext<ThemeContextValue>({
  theme: 'terminal',
  setTheme: () => {},
  accentHex: ACCENT_HEX.terminal,
  secondaryHex: SECONDARY_HEX.terminal,
});

function isValidTheme(v: string | null): v is ThemeId {
  return v === 'terminal' || v === 'amber' || v === 'cyan' || v === 'copper';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('terminal');

  // Sync persisted theme on mount (inline script already set the DOM attribute,
  // but we need React state to match)
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (isValidTheme(current)) {
      setThemeState(current);
    } else {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isValidTheme(stored)) {
          setThemeState(stored);
          document.documentElement.setAttribute('data-theme', stored);
        }
      } catch {
        // localStorage unavailable
      }
    }
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // localStorage unavailable
    }
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        setTheme,
        accentHex: ACCENT_HEX[theme],
        secondaryHex: SECONDARY_HEX[theme],
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
