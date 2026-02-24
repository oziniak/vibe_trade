'use client';

import { useTheme, THEMES } from '@/lib/theme';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Color theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.label}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          className={`size-3.5 rounded-full transition-all duration-200 ${
            theme === t.id
              ? 'ring-[1.2px] ring-white/40 ring-offset-1 ring-offset-vt-bg1 scale-125'
              : 'opacity-50 hover:opacity-90 hover:scale-110'
          }`}
          style={{ backgroundColor: t.color }}
        />
      ))}
    </div>
  );
}
