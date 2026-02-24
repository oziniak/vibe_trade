import { useState, useEffect, useCallback } from 'react';

/**
 * Countdown hook that ticks once per second.
 * Returns [secondsRemaining, start(seconds), clear()].
 */
export function useCountdown(): [number, (seconds: number) => void, () => void] {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const start = useCallback((seconds: number) => {
    setExpiresAt(Date.now() + seconds * 1000);
    setRemaining(seconds);
  }, []);

  const clear = useCallback(() => {
    setExpiresAt(null);
    setRemaining(0);
  }, []);

  useEffect(() => {
    if (expiresAt === null) return;

    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        setExpiresAt(null);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt]);

  return [remaining, start, clear];
}
