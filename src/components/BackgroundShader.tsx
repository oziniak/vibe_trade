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
  height: number;
  candleW: number;
  gap: number;
  speed: number;
  oscAmp: number;
  oscFreq: number;
  oscPhase: number;
  totalW: number;
}

/** Candlestick-inspired particle. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'candle' | 'spark' | 'orb';
  bull: boolean; // true = green, false = red
  size: number;
  baseA: number;
  phase: number;
  life: number; // 0–1, particles fade as life decreases
  maxLife: number;
  // Candle-type specific
  bodyRatio: number; // body height relative to total height
  wickRatio: number; // wick extension ratio
}

// ---------------------------------------------------------------------------
// Colors — stock exchange inspired
// ---------------------------------------------------------------------------

const BULL_GREEN = { r: 34, g: 197, b: 94 }; // #22c55e
const BEAR_RED = { r: 239, g: 68, b: 68 }; // #ef4444
const BULL_GREEN_BRIGHT = { r: 74, g: 222, b: 128 }; // brighter for sparks
const BEAR_RED_BRIGHT = { r: 252, g: 129, b: 129 }; // brighter for sparks

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
    opacity: 0.06 + depth * 0.09, // boosted from 0.035 + depth * 0.055
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

function makeParticle(vw: number, vh: number): Particle {
  const bull = Math.random() > 0.5;
  const typeRoll = Math.random();
  const type: Particle['type'] =
    typeRoll < 0.4 ? 'candle' : typeRoll < 0.7 ? 'spark' : 'orb';

  const baseSpeed = type === 'candle' ? 0.1 : type === 'spark' ? 0.4 : 0.15;
  // Bull particles tend upward, bear tend downward
  const dirBias = bull ? -1 : 1;

  return {
    x: Math.random() * vw,
    y: Math.random() * vh,
    vx: (Math.random() - 0.5) * baseSpeed * 0.6,
    vy: dirBias * (0.08 + Math.random() * baseSpeed),
    type,
    bull,
    size:
      type === 'candle'
        ? 8 + Math.random() * 12 // 8–20px wide, clearly visible candlesticks
        : type === 'spark'
          ? 1.5 + Math.random() * 2.5
          : 2 + Math.random() * 3.5,
    baseA:
      type === 'candle'
        ? 0.06 + Math.random() * 0.12
        : type === 'spark'
          ? 0.2 + Math.random() * 0.35
          : 0.08 + Math.random() * 0.18,
    phase: Math.random() * Math.PI * 2,
    life: 1,
    maxLife: 8000 + Math.random() * 12000,
    bodyRatio: 0.4 + Math.random() * 0.3,
    wickRatio: 0.15 + Math.random() * 0.2,
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
  // Pulsing intensity
  const pulse = 0.85 + Math.sin(t * 0.0004) * 0.15;

  const sources: [number, number, number, number][] = [
    // Main accent glow — more intense
    [
      w * (0.3 + Math.sin(t * 0.0003) * 0.15),
      h * (0.4 + Math.cos(t * 0.00025) * 0.15),
      0.18 * pulse,
      1,
    ],
    [
      w * (0.7 + Math.cos(t * 0.0002) * 0.12),
      h * (0.6 + Math.sin(t * 0.00035) * 0.12),
      0.13 * pulse,
      0.85,
    ],
    // Subtle green glow (bull)
    [
      w * (0.2 + Math.sin(t * 0.00015) * 0.1),
      h * (0.3 + Math.cos(t * 0.0002) * 0.1),
      0.04,
      0.6,
    ],
    // Subtle red glow (bear)
    [
      w * (0.8 + Math.cos(t * 0.00018) * 0.1),
      h * (0.7 + Math.sin(t * 0.00022) * 0.1),
      0.035,
      0.55,
    ],
  ];
  const rad = Math.max(w, h) * 0.5;

  // Main accent sources
  for (let i = 0; i < 2; i++) {
    const [cx, cy, a, rf] = sources[i];
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * rf);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    gr.addColorStop(0.35, `rgba(${r},${g},${b},${a * 0.4})`);
    gr.addColorStop(0.7, `rgba(${r},${g},${b},${a * 0.1})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }

  // Green glow
  {
    const [cx, cy, a, rf] = sources[2];
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * rf);
    gr.addColorStop(
      0,
      `rgba(${BULL_GREEN.r},${BULL_GREEN.g},${BULL_GREEN.b},${a})`
    );
    gr.addColorStop(
      0.5,
      `rgba(${BULL_GREEN.r},${BULL_GREEN.g},${BULL_GREEN.b},${a * 0.25})`
    );
    gr.addColorStop(
      1,
      `rgba(${BULL_GREEN.r},${BULL_GREEN.g},${BULL_GREEN.b},0)`
    );
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }

  // Red glow
  {
    const [cx, cy, a, rf] = sources[3];
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * rf);
    gr.addColorStop(
      0,
      `rgba(${BEAR_RED.r},${BEAR_RED.g},${BEAR_RED.b},${a})`
    );
    gr.addColorStop(
      0.5,
      `rgba(${BEAR_RED.r},${BEAR_RED.g},${BEAR_RED.b},${a * 0.25})`
    );
    gr.addColorStop(
      1,
      `rgba(${BEAR_RED.r},${BEAR_RED.g},${BEAR_RED.b},0)`
    );
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

    // Fade at viewport edges
    const nx = px / vw;
    const fade = Math.pow(Math.max(0, Math.sin(nx * Math.PI)), 0.6);
    const alpha = s.opacity * fade;
    if (alpha < 0.003) {
      px += step;
      continue;
    }

    const bull = cd.c >= cd.o;
    // Use red/green for candles instead of monochrome accent
    const col = bull ? BULL_GREEN : BEAR_RED;
    // Blend with accent: 60% candle color, 40% accent
    const [ar, ag, ab] = rgb;
    const mr = Math.round(col.r * 0.6 + ar * 0.4);
    const mg = Math.round(col.g * 0.6 + ag * 0.4);
    const mb = Math.round(col.b * 0.6 + ab * 0.4);

    const py = (p: number) => cy + s.height * (0.5 - p);
    const hY = py(cd.h);
    const lY = py(cd.l);
    const oY = py(cd.o);
    const cY = py(cd.c);
    const bodyTop = Math.min(oY, cY);
    const bodyH = Math.max(Math.abs(oY - cY), 0.8);

    // Wick
    ctx.strokeStyle = `rgba(${mr},${mg},${mb},${alpha * 0.55})`;
    ctx.lineWidth = Math.max(0.5, s.candleW * 0.15);
    ctx.beginPath();
    ctx.moveTo(px + s.candleW * 0.5, hY);
    ctx.lineTo(px + s.candleW * 0.5, lY);
    ctx.stroke();

    // Body — bull is filled, bear is slightly less opaque
    const bAlpha = bull ? alpha * 1.1 : alpha * 0.7;
    ctx.fillStyle = `rgba(${mr},${mg},${mb},${bAlpha})`;
    ctx.fillRect(px, bodyTop, s.candleW, bodyH);

    px += step;
  }
}

function paintParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  t: number,
  vw: number,
  vh: number
) {
  for (const p of particles) {
    if (p.life <= 0) continue;

    // Pulsing + life-based fade
    const pulse =
      0.7 + Math.sin(t * 0.002 + p.phase) * 0.3;
    const lifeFade = Math.min(1, p.life * 3); // fade in last 33% of life
    const edgeFadeX =
      Math.min(1, p.x / (vw * 0.15)) *
      Math.min(1, (vw - p.x) / (vw * 0.15));
    const edgeFadeY =
      Math.min(1, p.y / (vh * 0.15)) *
      Math.min(1, (vh - p.y) / (vh * 0.15));
    const edgeFade = Math.max(0, edgeFadeX * edgeFadeY);
    const a = p.baseA * pulse * lifeFade * edgeFade;

    if (a < 0.005) continue;

    const col = p.bull ? BULL_GREEN : BEAR_RED;
    const bright = p.bull ? BULL_GREEN_BRIGHT : BEAR_RED_BRIGHT;

    if (p.type === 'candle') {
      // Recognisable candlestick: tall body, thin wick, soft halo
      const w = p.size; // 8–20px wide
      const totalH = p.size * 4; // 32–80px total height
      const bodyH = totalH * p.bodyRatio; // ~40–70% of total
      const wickExt = totalH * p.wickRatio; // wick beyond body
      const bodyY = p.y - bodyH / 2;

      // Soft glow halo behind the candle
      const glowR = p.size * 3.5;
      const glow = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        glowR
      );
      glow.addColorStop(
        0,
        `rgba(${col.r},${col.g},${col.b},${a * 0.2})`
      );
      glow.addColorStop(
        0.5,
        `rgba(${col.r},${col.g},${col.b},${a * 0.06})`
      );
      glow.addColorStop(
        1,
        `rgba(${col.r},${col.g},${col.b},0)`
      );
      ctx.fillStyle = glow;
      ctx.fillRect(
        p.x - glowR,
        p.y - glowR,
        glowR * 2,
        glowR * 2
      );

      // Wick (thin vertical line through the candle)
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${a * 0.7})`;
      ctx.lineWidth = Math.max(1, w * 0.12);
      ctx.beginPath();
      ctx.moveTo(p.x, bodyY - wickExt);
      ctx.lineTo(p.x, bodyY + bodyH + wickExt);
      ctx.stroke();

      // Body (solid rectangle with rounded corners for polish)
      const cornerR = Math.min(2, w * 0.15);
      ctx.fillStyle = `rgba(${bright.r},${bright.g},${bright.b},${a})`;
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, bodyY, w, bodyH, cornerR);
      ctx.fill();

      // Body border for definition
      ctx.strokeStyle = `rgba(${bright.r},${bright.g},${bright.b},${a * 0.4})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, bodyY, w, bodyH, cornerR);
      ctx.stroke();
    } else if (p.type === 'spark') {
      // Small bright spark with trail
      const trailLen = 4 + p.size * 2;
      const angle = Math.atan2(p.vy, p.vx);
      const tx = p.x - Math.cos(angle) * trailLen;
      const ty = p.y - Math.sin(angle) * trailLen;

      // Trail
      const trail = ctx.createLinearGradient(tx, ty, p.x, p.y);
      trail.addColorStop(
        0,
        `rgba(${col.r},${col.g},${col.b},0)`
      );
      trail.addColorStop(
        1,
        `rgba(${bright.r},${bright.g},${bright.b},${a * 0.7})`
      );
      ctx.strokeStyle = trail;
      ctx.lineWidth = p.size * 0.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // Head glow
      const headGlow = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        p.size * 3
      );
      headGlow.addColorStop(
        0,
        `rgba(${bright.r},${bright.g},${bright.b},${a * 0.5})`
      );
      headGlow.addColorStop(
        1,
        `rgba(${col.r},${col.g},${col.b},0)`
      );
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(${bright.r},${bright.g},${bright.b},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Orb — glowing circle with soft halo
      const orbGlow = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        p.size * 4
      );
      orbGlow.addColorStop(
        0,
        `rgba(${bright.r},${bright.g},${bright.b},${a * 0.6})`
      );
      orbGlow.addColorStop(
        0.3,
        `rgba(${col.r},${col.g},${col.b},${a * 0.25})`
      );
      orbGlow.addColorStop(
        1,
        `rgba(${col.r},${col.g},${col.b},0)`
      );
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(255,255,255,${a * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
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
    const PARTICLE_N = Math.max(20, Math.floor((vw * vh) / 28000));

    let strips: Strip[] = Array.from({ length: STRIP_N }, (_, i) =>
      makeStrip(vw, vh, i, STRIP_N)
    );
    let particles: Particle[] = Array.from({ length: PARTICLE_N }, () =>
      makeParticle(vw, vh)
    );

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

      // Layer 1 — gradient glow (enhanced)
      paintGlow(ctx, vw, vh, now, rgb);

      // Layer 2 — candlestick strips (red/green)
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

      // Layer 3 — candlestick-inspired particles
      if (!slow) {
        for (const p of particles) {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          p.life -= dt / p.maxLife;

          // Respawn dead or out-of-bounds particles
          if (
            p.life <= 0 ||
            p.y < -30 ||
            p.y > vh + 30 ||
            p.x < -30 ||
            p.x > vw + 30
          ) {
            Object.assign(p, makeParticle(vw, vh));
            // Start from edge based on direction
            if (p.bull) {
              p.y = vh + 10 + Math.random() * 30;
            } else {
              p.y = -10 - Math.random() * 30;
            }
          }
        }
      }
      paintParticles(ctx, particles, now, vw, vh);

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
