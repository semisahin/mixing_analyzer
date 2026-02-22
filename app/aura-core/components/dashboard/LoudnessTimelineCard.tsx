"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Theme, UiTokens, Rgb } from "../../lib/types";
import type { RefObject } from "react";

type Point = { t: number; st: number; m: number };

type Props = {
  theme: Theme;

  targetLUFSRef: RefObject<number>;
  targetLUFS: number;
  toleranceLU: number;

  ui: UiTokens;
  accentRgb: Rgb;

  getSnapshot: () => Point[];
  getPlayheadTime: () => number;

  totalSeconds: number;
  onSeekSeconds: (t: number) => void;

  uiHz?: number;
};

// ================= SEGMENT BUFFERS =================

type SegBuf = { starts: Int32Array; ends: Int32Array; count: number };

function ensureSegCapacity(buf: SegBuf, needed: number): SegBuf {
  if (buf.starts.length >= needed) return buf;
  let cap = buf.starts.length || 128;
  while (cap < needed) cap *= 2;
  return { starts: new Int32Array(cap), ends: new Int32Array(cap), count: 0 };
}

type ClickSegBuf = {
  x0: Float32Array;
  x1: Float32Array;
  startT: Float32Array;
  endT: Float32Array;
  count: number;
};

function ensureClickSegCapacity(buf: ClickSegBuf, needed: number): ClickSegBuf {
  if (buf.x0.length >= needed) return buf;
  let cap = buf.x0.length || 128;
  while (cap < needed) cap *= 2;
  return {
    x0: new Float32Array(cap),
    x1: new Float32Array(cap),
    startT: new Float32Array(cap),
    endT: new Float32Array(cap),
    count: 0,
  };
}

// ================= PROBLEM SEGMENTS =================

function buildProblemSegments(
  data: Point[],
  targetLUFS: number,
  toleranceLU: number,
  out: SegBuf,
  opts?: { minLen?: number; gapMerge?: number }
): SegBuf {
  const n = data.length;
  const minLen = opts?.minLen ?? 3;
  const gapMerge = opts?.gapMerge ?? 1;

  out = ensureSegCapacity(out, Math.max(32, (n >> 1) + 1));
  out.count = 0;

  if (n < 2 || !Number.isFinite(targetLUFS) || !(toleranceLU >= 0)) return out;

  let inSeg = false;
  let segStart = 0;
  let lastEnd = -999999;

  for (let i = 0; i < n; i++) {
    const st = data[i].st;
    const bad = Number.isFinite(st) && Math.abs(st - targetLUFS) > toleranceLU;

    if (bad) {
      if (!inSeg) {
        inSeg = true;
        segStart = i;
      }
      continue;
    }

    if (inSeg) {
      const segEnd = i - 1;
      inSeg = false;

      const len = segEnd - segStart + 1;
      if (len >= minLen) {
        if (out.count > 0 && segStart - lastEnd <= gapMerge + 1) {
          out.ends[out.count - 1] = segEnd;
          lastEnd = segEnd;
        } else {
          out.starts[out.count] = segStart;
          out.ends[out.count] = segEnd;
          out.count++;
          lastEnd = segEnd;
        }
      }
    }
  }

  if (inSeg) {
    const segEnd = n - 1;
    const len = segEnd - segStart + 1;
    if (len >= minLen) {
      if (out.count > 0 && segStart - lastEnd <= gapMerge + 1) {
        out.ends[out.count - 1] = segEnd;
      } else {
        out.starts[out.count] = segStart;
        out.ends[out.count] = segEnd;
        out.count++;
      }
    }
  }

  return out;
}

function drawProblemBands(
  ctx: CanvasRenderingContext2D,
  data: Point[],
  segs: SegBuf,
  plotW: number,
  h: number,
  theme: Theme,
  opts?: { padSamples?: number; opacityDark?: number; opacityLight?: number }
) {
  const n = data.length;
  if (n < 2 || segs.count === 0) return;

  const tMin = data[0].t;
  const tMax = data[n - 1].t;
  const dt = Math.max(1e-6, tMax - tMin);

  const pad = opts?.padSamples ?? 1;
  const alpha = theme === "dark" ? (opts?.opacityDark ?? 0.1) : (opts?.opacityLight ?? 0.1);
  ctx.fillStyle = theme === "dark" ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;

  const xOfT = (t: number) => ((t - tMin) / dt) * plotW;

  for (let s = 0; s < segs.count; s++) {
    let i0 = segs.starts[s] - pad;
    let i1 = segs.ends[s] + pad;
    if (i0 < 0) i0 = 0;
    if (i1 > n - 1) i1 = n - 1;

    const x0 = xOfT(data[i0].t);
    const x1 = xOfT(data[i1].t);

    const left = Math.max(0, Math.min(plotW, x0));
    const right = Math.max(0, Math.min(plotW, x1));
    const bw = Math.max(1, right - left);

    ctx.fillRect(left, 0, bw, h);
  }
}

// ================= DPR / RESIZE HELPERS =================

type CanvasCleanup = { ro?: ResizeObserver; onWinResize?: () => void; raf?: number };

function setupCrispCanvas(canvas: HTMLCanvasElement): CanvasCleanup {
  let raf = 0;

  const applySize = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();

    const nextW = Math.max(1, Math.floor(rect.width * dpr));
    const nextH = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== nextW) canvas.width = nextW;
    if (canvas.height !== nextH) canvas.height = nextH;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applySize);
  };

  const ro = new ResizeObserver(schedule);
  ro.observe(canvas);

  const onWinResize = schedule;
  window.addEventListener("resize", onWinResize);

  applySize();

  return { ro, onWinResize, raf };
}

function teardownCrispCanvas(clean: CanvasCleanup) {
  if (clean.onWinResize) window.removeEventListener("resize", clean.onWinResize);
  clean.ro?.disconnect();
  if (clean.raf) cancelAnimationFrame(clean.raf);
}

// ================= COMPONENT =================

export default function LoudnessTimelineCard({
  theme,
  ui,
  accentRgb,
  getSnapshot,
  getPlayheadTime,
  totalSeconds,
  onSeekSeconds,
  targetLUFSRef,
  targetLUFS,
  toleranceLU,
  uiHz = 15,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const canvasCompactRef = useRef<HTMLCanvasElement | null>(null);
  const canvasZoomRef = useRef<HTMLCanvasElement | null>(null);

  const compactCleanupRef = useRef<CanvasCleanup | null>(null);
  const zoomCleanupRef = useRef<CanvasCleanup | null>(null);

  useLayoutEffect(() => {
    const c = canvasCompactRef.current;
    if (!c) return;
    compactCleanupRef.current = setupCrispCanvas(c);
    return () => {
      if (compactCleanupRef.current) teardownCrispCanvas(compactCleanupRef.current);
      compactCleanupRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!expanded) return;
    const c = canvasZoomRef.current;
    if (!c) return;

    zoomCleanupRef.current = setupCrispCanvas(c);

    return () => {
      if (zoomCleanupRef.current) teardownCrispCanvas(zoomCleanupRef.current);
      zoomCleanupRef.current = null;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const rafId = useRef<number | null>(null);
  const running = useRef(false);

  const pulseUntilRef = useRef<number>(0);
  const lastTargetRef = useRef<number>(Number.NaN);

  const targetDispRef = useRef<number>(Number.NaN);
  const tolDispRef = useRef<number>(Number.NaN);
  const lastDrawMsRef = useRef<number>(0);

  const segsRef = useRef<SegBuf>({
    starts: new Int32Array(256),
    ends: new Int32Array(256),
    count: 0,
  });

  const clickSegRef = useRef<ClickSegBuf>({
    x0: new Float32Array(256),
    x1: new Float32Array(256),
    startT: new Float32Array(256),
    endT: new Float32Array(256),
    count: 0,
  });

  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(targetLUFS)) return;
    if (targetLUFS !== lastTargetRef.current) {
      lastTargetRef.current = targetLUFS;
      pulseUntilRef.current = performance.now() + 160;

      if (!Number.isFinite(targetDispRef.current)) targetDispRef.current = targetLUFS;
      if (!Number.isFinite(tolDispRef.current)) tolDispRef.current = toleranceLU;
    }
  }, [targetLUFS, toleranceLU]);

  const safeGetSnapshot = useMemo(() => {
    return () => getSnapshot();
  }, [getSnapshot]);

  // ================= DRAW LOOP =================
  useEffect(() => {
    running.current = true;

    let lastUiMs = 0;
    const interval = 1000 / uiHz;

    const draw = (nowMs: number) => {
      if (!running.current) return;

      if (nowMs - lastUiMs < interval) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }
      lastUiMs = nowMs;

      const c = expanded ? canvasZoomRef.current : canvasCompactRef.current;
      if (!c) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }
      const ctx = c.getContext("2d");
      if (!ctx) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }

      const rect = c.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      const data = safeGetSnapshot();
      if (data.length < 2) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }

      const labelPad = expanded ? 210 : 0;
      const plotW = Math.max(1, w - labelPad);
      const xLabel = w - 14;

      if (expanded) {
        ctx.save();
        ctx.fillStyle = theme === "dark" ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.88)";
        ctx.fillRect(plotW, 0, w - plotW, h);
        ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotW + 0.5, 0);
        ctx.lineTo(plotW + 0.5, h);
        ctx.stroke();
        ctx.restore();
      }

      const tMin = data[0].t;
      const tMax = data[data.length - 1].t;
      const dt = Math.max(1e-6, tMax - tMin);
      const xOfT = (t: number) => ((t - tMin) / dt) * plotW;

      let minL = Infinity;
      let maxL = -Infinity;
      for (let i = 0; i < data.length; i++) {
        const st = data[i].st;
        const m = data[i].m;
        if (Number.isFinite(st)) {
          if (st < minL) minL = st;
          if (st > maxL) maxL = st;
        }
        if (Number.isFinite(m)) {
          if (m < minL) minL = m;
          if (m > maxL) maxL = m;
        }
      }

      const span = maxL - minL;
      const minSpan = 3;
      const pad = 1.2;

      let bottom = minL - pad;
      let top = maxL + pad;

      if (!Number.isFinite(bottom) || !Number.isFinite(top)) {
        bottom = -36;
        top = -6;
      } else if (span < minSpan) {
        const mid = (minL + maxL) * 0.5;
        bottom = mid - minSpan * 0.5;
        top = mid + minSpan * 0.5;
      }

      const rawTarget = targetLUFSRef.current;
      const rawTol = Math.max(0, toleranceLU || 0);

      const prevMs = lastDrawMsRef.current || nowMs;
      const dtSec = Math.max(0, (nowMs - prevMs) / 1000);
      lastDrawMsRef.current = nowMs;

      const TAU = 0.18;
      const aa = 1 - Math.exp(-dtSec / Math.max(1e-6, TAU));

      if (Number.isFinite(rawTarget)) {
        if (!Number.isFinite(targetDispRef.current)) targetDispRef.current = rawTarget;
        targetDispRef.current += (rawTarget - targetDispRef.current) * aa;
      }
      if (Number.isFinite(rawTol)) {
        if (!Number.isFinite(tolDispRef.current)) tolDispRef.current = rawTol;
        tolDispRef.current += (rawTol - tolDispRef.current) * aa;
      }

      const tDisp = targetDispRef.current;
      const tolDisp = Math.max(0, tolDispRef.current || 0);

      if (Number.isFinite(tDisp)) {
        bottom = Math.min(bottom, tDisp - tolDisp - 0.6);
        top = Math.max(top, tDisp + tolDisp + 0.6);
      }

      const lufsToY = (lufs: number) => {
        const v = Number.isFinite(lufs) ? lufs : bottom;
        const clamped = Math.max(bottom, Math.min(top, v));
        const norm = (clamped - bottom) / Math.max(1e-6, top - bottom);
        return h - norm * h;
      };

      // ===== Problem bands =====
      segsRef.current = buildProblemSegments(data, tDisp, tolDisp, segsRef.current, {
        minLen: 3,
        gapMerge: 1,
      });

      // click hitboxes in plot-space
      {
        const segs = segsRef.current;
        let clicks = ensureClickSegCapacity(clickSegRef.current, Math.max(32, segs.count));
        clicks.count = 0;

        const padSamples = 1;

        for (let s = 0; s < segs.count; s++) {
          let i0 = segs.starts[s] - padSamples;
          let i1 = segs.ends[s] + padSamples;
          if (i0 < 0) i0 = 0;
          if (i1 > data.length - 1) i1 = data.length - 1;

          const x0 = xOfT(data[i0].t);
          const x1 = xOfT(data[i1].t);

          const left = Math.max(0, Math.min(plotW, x0));
          const right = Math.max(0, Math.min(plotW, x1));
          if (!(right > left)) continue;

          const k = clicks.count++;
          clicks.x0[k] = left;
          clicks.x1[k] = right;
          clicks.startT[k] = data[i0].t;
          clicks.endT[k] = data[i1].t;
        }

        clickSegRef.current = clicks;
      }

      drawProblemBands(ctx, data, segsRef.current, plotW, h, theme, {
        padSamples: 1,
        opacityDark: 0.1,
        opacityLight: 0.1,
      });

      // ===== Target zone =====
      if (Number.isFinite(tDisp) && tolDisp > 0) {
        const yTop = lufsToY(tDisp + tolDisp);
        const yBot = lufsToY(tDisp - tolDisp);
        const y = Math.min(yTop, yBot);
        const hh = Math.abs(yBot - yTop);

        const { r, g, b } = accentRgb;

        ctx.save();
        const grad = ctx.createLinearGradient(0, y, 0, y + hh);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.00)`);
        grad.addColorStop(0.2, `rgba(${r},${g},${b},0.07)`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.10)`);
        grad.addColorStop(0.8, `rgba(${r},${g},${b},0.07)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0.00)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, plotW, hh);
        ctx.restore();
      }

      // ===== Dashed target =====
      if (Number.isFinite(tDisp)) {
        const yT = lufsToY(tDisp);
        const pulsing = performance.now() < pulseUntilRef.current;

        ctx.save();
        ctx.strokeStyle = `rgb(${accentRgb.r},${accentRgb.g},${accentRgb.b})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.globalAlpha = pulsing ? 0.9 : 0.65;

        ctx.beginPath();
        ctx.moveTo(0, yT);
        ctx.lineTo(plotW, yT);
        ctx.stroke();
        ctx.restore();
      }

      // ===== Curves =====
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgb(${accentRgb.r},${accentRgb.g},${accentRgb.b})`;

      // Short-Term
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = xOfT(data[i].t);
        const y = lufsToY(data[i].st);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Momentary
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = xOfT(data[i].t);
        const y = lufsToY(data[i].m);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Playhead
      ctx.globalAlpha = 0.9;
      const ph = getPlayheadTime();
      const xPh = xOfT(ph);
      ctx.beginPath();
      ctx.moveTo(xPh, 0);
      ctx.lineTo(xPh, h);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // ===== Inline labels (ONLY expanded) — FIXED: swatch never crosses text =====
      if (expanded) {
        const ink = theme === "dark" ? "rgba(255,255,255,0.96)" : "rgba(0,0,0,0.92)";
        const halo = theme === "dark" ? "rgba(0,0,0,0.88)" : "rgba(255,255,255,0.94)";
        const tagBg = theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.70)";

        ctx.save();
        ctx.font =
          '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        const y0 = 20;
        const row = 18;

        const yTarget = y0 + row * 0;
        const yST = y0 + row * 1;
        const yM = y0 + row * 2;

        const swLen = 22;
        const gap = 10; // gap between swatch end and text start
        const padX = 6; // background padding
        const padY = 5;

        const drawLabel = (
          text: string,
          y: number,
          alpha: number,
          sw?: { dashed?: boolean; width?: number; lineAlpha?: number }
        ) => {
          ctx.globalAlpha = alpha;

          // measure text (IMPORTANT)
          const tw = ctx.measureText(text).width;

          // swatch strictly left of text block
          const textRight = xLabel;
          const textLeft = textRight - tw;

          const sw1 = textLeft - gap;
          const sw0 = sw1 - swLen;

          // background tag behind text (keeps it readable even over bright lines)
          ctx.save();
          ctx.globalAlpha = Math.min(1, alpha * 0.9);
          ctx.fillStyle = tagBg;
          const bx = textLeft - padX;
          const by = y - padY;
          const bw = tw + padX * 2;
          const bh = padY * 2;
          ctx.fillRect(bx, by, bw, bh);
          ctx.restore();

          // swatch
          if (sw) {
            ctx.save();
            ctx.globalAlpha = sw.lineAlpha ?? alpha;
            ctx.strokeStyle = ink;
            ctx.lineWidth = sw.width ?? 2;
            ctx.setLineDash(sw.dashed ? [4, 4] : []);
            ctx.beginPath();
            ctx.moveTo(sw0, y);
            ctx.lineTo(sw1, y);
            ctx.stroke();
            ctx.restore();
          }

          // halo + text
          ctx.lineWidth = 4;
          ctx.strokeStyle = halo;
          ctx.strokeText(text, xLabel, y);

          ctx.fillStyle = ink;
          ctx.fillText(text, xLabel, y);
        };

        if (Number.isFinite(tDisp)) {
          drawLabel("Target", yTarget, 0.78, { dashed: true, width: 2, lineAlpha: 0.78 });
        }
        drawLabel("Short-Term (3s)", yST, 0.95, { dashed: false, width: 2, lineAlpha: 0.95 });
        drawLabel("Momentary (400ms)", yM, 0.72, { dashed: false, width: 1, lineAlpha: 0.72 });

        ctx.restore();
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      running.current = false;
      const id = rafId.current;
      if (id != null) cancelAnimationFrame(id);
      rafId.current = null;
    };
  }, [
    expanded,
    theme,
    safeGetSnapshot,
    getPlayheadTime,
    uiHz,
    accentRgb.r,
    accentRgb.g,
    accentRgb.b,
    targetLUFS,
    toleranceLU,
    targetLUFSRef,
  ]);

  // ================= SEEK / POINTER =================

  const seekEnabled = Number.isFinite(totalSeconds) && totalSeconds > 0.1;

  const handlePointer = (clientX: number, shiftKey: boolean, rectLeft: number, plotW: number) => {
    if (!seekEnabled) return;

    const x = clientX - rectLeft;
    if (x < 0 || x > plotW) return;

    const clicks = clickSegRef.current;
    for (let i = 0; i < clicks.count; i++) {
      if (x >= clicks.x0[i] && x <= clicks.x1[i]) {
        const t = shiftKey ? clicks.endT[i] : clicks.startT[i];
        if (Number.isFinite(t)) onSeekSeconds(t);
        return;
      }
    }

    const ratio = Math.min(1, Math.max(0, x / plotW));
    const t = ratio * totalSeconds;
    if (Number.isFinite(t)) onSeekSeconds(t);
  };

  const bindPointerHandlers = (canvasRef: React.RefObject<HTMLCanvasElement | null>, isZoom: boolean) => {
    const labelPad = isZoom ? 210 : 0;

    return {
      onPointerDownCapture: (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const c = canvasRef.current;
        if (!c) return;

        draggingRef.current = true;
        pointerIdRef.current = e.pointerId;

        try {
          c.setPointerCapture(e.pointerId);
        } catch {}

        const rect = c.getBoundingClientRect();
        const plotW = Math.max(1, rect.width - labelPad);
        handlePointer(e.clientX, e.shiftKey, rect.left, plotW);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        if (pointerIdRef.current !== e.pointerId) return;

        e.preventDefault();
        e.stopPropagation();

        const c = canvasRef.current;
        if (!c) return;

        const rect = c.getBoundingClientRect();
        const plotW = Math.max(1, rect.width - labelPad);
        handlePointer(e.clientX, e.shiftKey, rect.left, plotW);
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (pointerIdRef.current === e.pointerId) {
          draggingRef.current = false;
          pointerIdRef.current = null;
        }
        const c = canvasRef.current;
        if (!c) return;
        try {
          c.releasePointerCapture(e.pointerId);
        } catch {}
      },
      onPointerCancel: (e: React.PointerEvent) => {
        if (pointerIdRef.current === e.pointerId) {
          draggingRef.current = false;
          pointerIdRef.current = null;
        }
        const c = canvasRef.current;
        if (!c) return;
        try {
          c.releasePointerCapture(e.pointerId);
        } catch {}
      },
    };
  };

  const compactHandlers = bindPointerHandlers(canvasCompactRef, false);
  const zoomHandlers = bindPointerHandlers(canvasZoomRef, true);

  return (
    <>
      <div className={`relative w-full rounded-2xl ${ui.cardB} p-4 sm:p-5`} onPointerDown={(e) => e.stopPropagation()}>
        <canvas
          ref={canvasCompactRef}
          style={{
            width: "100%",
            height: 120,
            display: "block",
            cursor: seekEnabled ? "ew-resize" : "default",
            touchAction: "none",
          }}
          {...compactHandlers}
        />

        <div className="mt-2 text-xs opacity-70">Short-Term (3s) + Momentary (400ms)</div>

        <button
          type="button"
          aria-label="Expand Loudness Timeline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(true);
          }}
          className={[
            "absolute bottom-3 right-3",
            "h-9 w-9 rounded-xl border",
            theme === "dark" ? "border-white/10 bg-black/40" : "border-black/10 bg-white/60",
            "backdrop-blur-sm",
            "transition",
            "hover:scale-[1.03]",
            "hover:" + ui.accentGlowSoft,
          ].join(" ")}
        >
          <span
            className="block text-[14px] leading-none"
            style={{
              color: theme === "dark" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            }}
          >
            ⤢
          </span>
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className={["absolute inset-0", theme === "dark" ? "bg-black/70" : "bg-black/55", "backdrop-blur-sm"].join(" ")} />

          <div
            className={[
              "relative w-[min(1100px,96vw)]",
              "rounded-2xl",
              theme === "dark" ? "bg-[#0b0b0b] border border-white/10" : "bg-white border border-black/10",
              "shadow-2xl",
              "p-4 sm:p-5",
            ].join(" ")}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm opacity-80">Loudness Timeline</div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded(false);
                }}
                className={[
                  "h-9 w-9 rounded-xl border",
                  theme === "dark" ? "border-white/10 bg-black/40" : "border-black/10 bg-white/60",
                  "transition hover:" + ui.accentGlowSoft,
                ].join(" ")}
                aria-label="Close"
              >
                <span className="block text-[14px] leading-none" style={{ color: theme === "dark" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)" }}>
                  ×
                </span>
              </button>
            </div>

            <canvas
              ref={canvasZoomRef}
              style={{
                width: "100%",
                height: 380,
                display: "block",
                cursor: seekEnabled ? "ew-resize" : "default",
                touchAction: "none",
              }}
              {...zoomHandlers}
            />

            <div className="mt-3 text-xs opacity-70">
              {seekEnabled
                ? "Click problem bands to jump. Shift+Click = end. Drag = scrub. Esc = close."
                : "Waiting for duration… (seek disabled until audio metadata is ready)."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}