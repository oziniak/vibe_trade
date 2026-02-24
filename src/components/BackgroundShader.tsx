'use client';

import { useEffect, useRef, memo } from 'react';
import { useTheme, ACCENT_HEX } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Single candlestick with normalised prices (0–1). */
interface Candle {
  o: number;
  c: number;
  h: number;
  l: number;
}

/** A horizontal strip of candlestick data that drifts leftward. */
interface Strip {
  x: number;
  baseY: number;
  candles: Candle[];
  opacity: number;
  height: number; // price-range in pixels
  candleW: number;
  gap: number;
  speed: number;
  oscAmp: number;
  oscFreq: number;
  oscPhase: number;
  totalW: number;
}

/** Ambient floating particle. */
interface Dot {
  x: number;
  y: number;
  r: number;
  baseA: number;
  phase: number;
  vx: number;
  vy: number;
}

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

function genCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let p = 0.3 + Math.random() * 0.4;
  const drift = (Math.random() - 0.5) * 0.0015;

  for (let i = 0; i < n; i++) {
    const vol = 0.012 + Math.random() * 0.035;
    const move = drift + (Math.random() - 0.5) * vol;
    const o = p;
    const c = Math.max(0.05, Math.min(0.95, p + move));
    const wUp = Math.random() * vol * 0.6;
    const wDn = Math.random() * vol * 0.6;
    out.push({
      o,
      c,
      h: Math.min(1, Math.max(o, c) + wUp),
      l: Math.max(0, Math.min(o, c) - wDn),
    });
    p = c;
    if (p > 0.85) p -= 0.04;
    if (p < 0.15) p += 0.04;
  }
  return out;
}

function makeStrip(
  vw: number,
  vh: number,
  idx: number,
  total: number
): Strip {
  const depth = Math.random();
  const candleW = Math.max(2, Math.round(2 + depth * 5));
  const gap = Math.max(1, Math.round(1 + Math.random() * 1.5));
  const step = candleW + gap;
  const count = Math.ceil((vw * 1.6) / step) + 20;
  const band = vh / (total + 1);

  return {
    x: -Math.random() * count * step * 0.3,
    baseY: band * (idx + 1) + (Math.random() - 0.5) * band * 0.4,
    candles: genCandles(count),
    opacity: 0.035 + depth * 0.055,
    height: (30 + depth * 50) * (0.3 + depth * 0.9),
    candleW,
    gap,
    speed: 0.12 + (1 - depth) * 0.28 + Math.random() * 0.1,
    oscAmp: 2 + Math.random() * 6,
    oscFreq: 0.0004 + Math.random() * 0.0008,
    oscPhase: Math.random() * Math.PI * 2,
    totalW: count * step,
  };
}

function makeDot(vw: number, vh: number): Dot {
  return {
    x: Math.random() * vw,
    y: Math.random() * vh,
    r: 0.4 + Math.random() * 1.2,
    baseA: 0.04 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -0.03 - Math.random() * 0.1,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function genNoiseUrl(): string {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const cx = cv.getContext('2d');
  if (!cx) return '';
  const img = cx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return cv.toDataURL();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function paintGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  rgb: [number, number, number]
) {
  const [r, g, b] = rgb;
  const sources: [number, number, number, number][] = [
    [
      w * (0.3 + Math.sin(t * 0.0003) * 0.15),
      h * (0.4 + Math.cos(t * 0.00025) * 0.15),
      0.1,
      1,
    ],
    [
      w * (0.7 + Math.cos(t * 0.0002) * 0.12),
      h * (0.6 + Math.sin(t * 0.00035) * 0.12),
      0.07,
      0.8,
    ],
  ];
  const rad = Math.max(w, h) * 0.45;

  for (const [cx, cy, a, rf] of sources) {
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * rf);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    gr.addColorStop(0.5, `rgba(${r},${g},${b},${a * 0.3})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }
}

function paintStrip(
  ctx: CanvasRenderingContext2D,
  s: Strip,
  t: number,
  rgb: [number, number, number],
  vw: number
) {
  const [r, g, b] = rgb;
  const yOff = Math.sin(t * s.oscFreq + s.oscPhase) * s.oscAmp;
  const cy = s.baseY + yOff;
  const step = s.candleW + s.gap;

  let px = s.x;
  for (const cd of s.candles) {
    if (px > vw + 20) break;
    if (px + s.candleW < -20) {
      px += step;
      continue;
    }

    // Fade at viewport edges (sin curve: 0 at edges, 1 at center)
    const nx = px / vw;
    const fade = Math.pow(Math.max(0, Math.sin(nx * Math.PI)), 0.6);
    const alpha = s.opacity * fade;
    if (alpha < 0.003) {
      px += step;
      continue;
    }

    const bull = cd.c >= cd.o;
    const py = (p: number) => cy + s.height * (0.5 - p);
    const hY = py(cd.h);
    const lY = py(cd.l);
    const oY = py(cd.o);
    const cY = py(cd.c);
    const bodyTop = Math.min(oY, cY);
    const bodyH = Math.max(Math.abs(oY - cY), 0.8);

    // Wick
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.45})`;
    ctx.lineWidth = Math.max(0.5, s.candleW * 0.15);
    ctx.beginPath();
    ctx.moveTo(px + s.candleW * 0.5, hY);
    ctx.lineTo(px + s.candleW * 0.5, lY);
    ctx.stroke();

    // Body
    const bAlpha = bull ? alpha : alpha * 0.5;
    ctx.fillStyle = `rgba(${r},${g},${b},${bAlpha})`;
    ctx.fillRect(px, bodyTop, s.candleW, bodyH);

    px += step;
  }
}

function paintDots(
  ctx: CanvasRenderingContext2D,
  dots: Dot[],
  rgb: [number, number, number],
  t: number
) {
  const [r, g, b] = rgb;
  for (const d of dots) {
    // Subtle pulsing opacity
    const a = d.baseA + Math.sin(t * 0.0015 + d.phase) * d.baseA * 0.35;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function BackgroundShaderInner() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const noiseRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const rafRef = useRef(0);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Noise texture (once)
  useEffect(() => {
    const el = noiseRef.current;
    if (!el) return;
    const url = genNoiseUrl();
    if (url) el.style.backgroundImage = `url(${url})`;
  }, []);

  // Main animation loop
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let vw = window.innerWidth;
    let vh = window.innerHeight;
    cv.width = vw;
    cv.height = vh;

    const STRIP_N = Math.max(3, Math.min(6, Math.floor(vw / 250)));
    const DOT_N = Math.max(15, Math.floor((vw * vh) / 40000));

    let strips: Strip[] = Array.from({ length: STRIP_N }, (_, i) =>
      makeStrip(vw, vh, i, STRIP_N)
    );
    let dots: Dot[] = Array.from({ length: DOT_N }, () => makeDot(vw, vh));

    const onResize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      cv.width = vw;
      cv.height = vh;
      const n = Math.max(3, Math.min(6, Math.floor(vw / 250)));
      strips = Array.from({ length: n }, (_, i) => makeStrip(vw, vh, i, n));
    };
    window.addEventListener('resize', onResize);

    let vis = true;
    const onVis = () => {
      vis = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    const slow = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let prev = 0;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!vis) return;
      if (now - prev < 33) return; // ~30 fps
      const dt = Math.min(now - prev, 100);
      prev = now;

      const rgb = hexRgb(ACCENT_HEX[themeRef.current]);
      ctx.clearRect(0, 0, vw, vh);

      // Layer 1 — gradient glow
      paintGlow(ctx, vw, vh, now, rgb);

      // Layer 2 — candlestick strips
      if (!slow) {
        for (const s of strips) {
          s.x -= s.speed * (dt / 16);
          if (s.x + s.totalW < -50) {
            s.x = vw + Math.random() * 100;
            s.candles = genCandles(s.candles.length);
          }
        }
      }
      for (const s of strips) {
        paintStrip(ctx, s, now, rgb, vw);
      }

      // Layer 3 — particles
      if (!slow) {
        for (const d of dots) {
          d.x += d.vx * (dt / 16);
          d.y += d.vy * (dt / 16);
          if (d.y < -10) {
            d.y = vh + 10;
            d.x = Math.random() * vw;
          }
          if (d.x < -10) d.x = vw + 10;
          if (d.x > vw + 10) d.x = -10;
        }
      }
      paintDots(ctx, dots, rgb, now);

      if (slow) cancelAnimationFrame(rafRef.current);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Canvas: gradient glow + candlestick strips + particles */}
      <canvas
        ref={cvRef}
        className="fixed inset-0 z-0 pointer-events-none w-full h-full"
        aria-hidden="true"
      />
      {/* Static noise grain overlay */}
      <div
        ref={noiseRef}
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{ backgroundRepeat: 'repeat', backgroundSize: '128px' }}
        aria-hidden="true"
      />
    </>
  );
}

export const BackgroundShader = memo(BackgroundShaderInner);
