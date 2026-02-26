const LOADER_BARS = [
  { h: 28, d: 0 },
  { h: 44, d: 0.12 },
  { h: 18, d: 0.24 },
  { h: 52, d: 0.36 },
  { h: 32, d: 0.48 },
  { h: 56, d: 0.6 },
  { h: 22, d: 0.72 },
] as const;

export function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-7 relative">
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 200,
          height: 200,
          background: 'var(--vt)',
          filter: 'blur(70px)',
          animation: 'vt-glow-breathe 3s ease-in-out infinite',
        }}
      />

      <div className="relative">
        <div
          className="relative px-1"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}
        >
          {LOADER_BARS.map((bar, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 1,
                  height: bar.h,
                  borderRadius: 1,
                  background: 'var(--vt)',
                  transformOrigin: 'bottom',
                  animation: `vt-bar-pulse 1.4s ease-in-out ${bar.d}s infinite`,
                }}
              />
              <div
                style={{
                  width: 6,
                  height: bar.h * 0.5,
                  borderRadius: 1,
                  background: 'var(--vt)',
                  transformOrigin: 'bottom',
                  animation: `vt-bar-pulse 1.4s ease-in-out ${bar.d}s infinite`,
                }}
              />
            </div>
          ))}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                width: 2,
                height: '100%',
                background:
                  'linear-gradient(180deg, transparent 0%, var(--vt) 30%, var(--vt-dim) 50%, var(--vt) 70%, transparent 100%)',
                boxShadow:
                  '0 0 8px 2px var(--vt-glow-soft), 0 0 20px 4px var(--vt-glow)',
                animation: 'vt-scan 1.8s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <p className="text-xs font-mono tracking-wider uppercase" style={{ color: 'var(--vt-dim)', opacity: 0.6 }}>
          {message}
        </p>
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 14,
            borderRadius: 1,
            background: 'var(--vt)',
            opacity: 0.5,
            animation: 'vt-cursor-blink 0.9s step-end infinite',
          }}
        />
      </div>
    </div>
  );
}
