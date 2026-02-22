import type { Theme, Rgb } from "../../lib/types";

function rgba(rgb: Rgb, a: number) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function isAccentVeryBright(accent: Rgb) {
  // quick luminance-ish check (fast, stable)
  const lum = (0.2126 * accent.r + 0.7152 * accent.g + 0.0722 * accent.b) / 255;
  return lum > 0.75;
}

export function drawGoniometer(
  canvas: HTMLCanvasElement,
  theme: Theme,
  accent: Rgb,
  l: Float32Array,
  r: Float32Array
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const centerX = w / 2;
  const centerY = h / 2;
  const scaleX = w * 0.42;
  const scaleY = h * 0.42;

  const DARK_GLOW_MULT = 0.5; // 20% reduction

  // ---- Trail / fade
  // Light mode: slightly stronger fade so old glow doesn't accumulate
  ctx.fillStyle = theme === "dark" ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.55)";
  ctx.fillRect(0, 0, w, h);

  // ---- Optional glow wash (DARK ONLY)
  if (theme === "dark") {
    const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, w / 2);
    glow.addColorStop(0, rgba(accent, 0.14 * DARK_GLOW_MULT));
    glow.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- Build path once
  ctx.beginPath();
  // NOTE: you step by 2; keep same behavior
  for (let i = 0; i < l.length; i += 2) {
    // Your original mapping: x from L, y from R (no inversion)
    const x = centerX + l[i] * scaleX;
    const y = centerY + r[i] * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // ---- Draw trace with theme-specific compositing
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (theme === "dark") {
    // Dark mode: glow + lighter looks good
    ctx.globalCompositeOperation = "lighter";

    // reduce glow intensity by ~20%
    ctx.shadowBlur = 18 * DARK_GLOW_MULT;
    ctx.shadowColor = `rgb(${accent.r},${accent.g},${accent.b})`;

    // Base stroke (neutral-ish) helps visibility even if accent is extreme
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Accent highlight
    ctx.shadowBlur = 22 * DARK_GLOW_MULT;
    ctx.strokeStyle = rgba(accent, 0.9);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  } else {
    // Light mode: disable glow + disable lighter (critical!)
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Strong neutral base stroke (black-ish) so it always reads
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Accent highlight on top (slightly lower alpha if accent is very bright)
    const a = isAccentVeryBright(accent) ? 0.55 : 0.70;
    ctx.strokeStyle = rgba(accent, a);
    ctx.lineWidth = 1.0;
    ctx.stroke();
  }

  ctx.restore();
}