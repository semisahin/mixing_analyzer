import type { Theme, Rgb } from "../../lib/types";

export function drawWaveform(
  canvas: HTMLCanvasElement,
  theme: Theme,
  accent: Rgb,
  dataL: Float32Array,
  dataR?: Float32Array
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth || 1;
  const cssH = canvas.offsetHeight || 1;

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  // no stacked transforms
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = theme === "dark" ? "#050505" : "#ffffff";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.strokeStyle = `rgb(${accent.r},${accent.g},${accent.b})`;
  ctx.lineWidth = 1.5;

  const centerY = cssH / 2;
  const step = Math.ceil(dataL.length / cssW);

  ctx.beginPath();
  for (let i = 0; i < cssW; i++) {
    let peak = 0;
    for (let j = 0; j < step; j++) {
      const idx = i * step + j;
      const sampleL = dataL[idx] ?? 0;
      const sampleR = dataR ? dataR[idx] ?? 0 : 0;
      const abs = Math.max(Math.abs(sampleL), Math.abs(sampleR));
      if (abs > peak) peak = abs;
    }
    const h = peak * (cssH / 2);
    ctx.moveTo(i, centerY - h);
    ctx.lineTo(i, centerY + h);
  }
  ctx.stroke();
}

