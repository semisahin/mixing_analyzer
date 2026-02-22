"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import type { Theme, UiTokens, Rgb } from "../../lib/types";
import type { RefObject } from "react";

type Point = { t: number; st: number; m: number };

type Props = {
  theme: Theme;

  targetLUFSRef: RefObject<number>;
  targetLUFS: number; // reactivity + pulse
  toleranceLU: number; // band

  ui: UiTokens;
  accentRgb: Rgb;

  getSnapshot: () => Point[];
  getPlayheadTime: () => number;

  totalSeconds: number;
  onSeekSeconds: (t: number) => void;

  uiHz?: number;
};

// ================= SEGMENT BUFFERS =================

type SegBuf = {
  starts: Int32Array;
  ends: Int32Array;
  count: number;
};

function ensureSegCapacity(buf: SegBuf, needed: number): SegBuf {
  if (buf.starts.length >= needed) return buf;
  let cap = buf.starts.length || 128;
  while (cap < needed) cap *= 2;
  return { starts: new Int32Array(cap), ends: new Int32Array(cap), count: 0 };
}

// Click hitboxes (typed arrays, no per-frame allocations)
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

// ================= PROBLEM SEGMENTS (REUSED BUFFERS) =================

function buildProblemSegments(
  data: Point[],
  targetLUFS: number,
  toleranceLU: number,
  out: SegBuf,
  opts?: { minLen?: number; gapMerge?: number }
): SegBuf {
  const n = data.length;
  const minLen = opts?.minLen ?? 3; // avoid single-frame flicker
  const gapMerge = opts?.gapMerge ?? 1; // merge tiny OK gaps

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
  w: number,
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
  const alpha = theme === "dark" ? (opts?.opacityDark ?? 0.10) : (opts?.opacityLight ?? 0.10);

  ctx.fillStyle = theme === "dark" ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;

  const xOfT = (t: number) => ((t - tMin) / dt) * w;

  for (let s = 0; s < segs.count; s++) {
    let i0 = segs.starts[s] - pad;
    let i1 = segs.ends[s] + pad;
    if (i0 < 0) i0 = 0;
    if (i1 > n - 1) i1 = n - 1;

    const x0 = xOfT(data[i0].t);
    const x1 = xOfT(data[i1].t);

    const left = Math.max(0, Math.min(w, x0));
    const right = Math.max(0, Math.min(w, x1));
    const bw = Math.max(1, right - left);

    ctx.fillRect(left, 0, bw, h);
  }
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafId = useRef<number | null>(null);
  const running = useRef(false);

  // pulse when target changes
  const pulseUntilRef = useRef<number>(0);
  const lastTargetRef = useRef<number>(Number.NaN);

  // UI smoothing for displayed target/tolerance
  const targetDispRef = useRef<number>(Number.NaN);
  const tolDispRef = useRef<number>(Number.NaN);
  const lastDrawMsRef = useRef<number>(0);

  // segment buffers
  const segsRef = useRef<SegBuf>({
    starts: new Int32Array(256),
    ends: new Int32Array(256),
    count: 0,
  });

  // clickable hitboxes
  const clickSegRef = useRef<ClickSegBuf>({
    x0: new Float32Array(256),
    x1: new Float32Array(256),
    startT: new Float32Array(256),
    endT: new Float32Array(256),
    count: 0,
  });

  // pointer drag state
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  // pulse init when profile changes
  useEffect(() => {
    if (!Number.isFinite(targetLUFS)) return;
    if (targetLUFS !== lastTargetRef.current) {
      lastTargetRef.current = targetLUFS;
      pulseUntilRef.current = performance.now() + 150;

      if (!Number.isFinite(targetDispRef.current)) targetDispRef.current = targetLUFS;
      if (!Number.isFinite(tolDispRef.current)) tolDispRef.current = toleranceLU;
    }
  }, [targetLUFS, toleranceLU]);

  // ===== DPR + element resize (crisp even when layout/grid changes) =====
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    let raf = 0;

    const applySize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = c.getBoundingClientRect();

      const nextW = Math.max(1, Math.floor(rect.width * dpr));
      const nextH = Math.max(1, Math.floor(rect.height * dpr));

      if (c.width !== nextW) c.width = nextW;
      if (c.height !== nextH) c.height = nextH;

      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applySize);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(c);

    applySize();
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

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

      const c = canvasRef.current;
      if (!c) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }
      const ctx = c.getContext("2d");
      if (!ctx) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }

      // draw in CSS pixels (setTransform(dpr,...) handles backing store)
      const rect = c.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      const data = getSnapshot();
      if (data.length < 2) {
        rafId.current = requestAnimationFrame(draw);
        return;
      }

      // time mapping
      const tMin = data[0].t;
      const tMax = data[data.length - 1].t;
      const dt = Math.max(1e-6, tMax - tMin);
      const xOfT = (t: number) => ((t - tMin) / dt) * w;

      // ===== Auto-range (based on curves) =====
      let minL = Infinity;
      let maxL = -Infinity;

      for (let i = 0; i < data.length; i++) {
        const st = data[i].st;
        const m = data[i].m;
        if (st < minL) minL = st;
        if (st > maxL) maxL = st;
        if (m < minL) minL = m;
        if (m > maxL) maxL = m;
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

      // ===== Smooth target/tolerance (UI-only) =====
      const rawTarget = targetLUFSRef.current;
      const rawTol = Math.max(0, toleranceLU || 0);

      const prevMs = lastDrawMsRef.current || nowMs;
      const dtSec = Math.max(0, (nowMs - prevMs) / 1000);
      lastDrawMsRef.current = nowMs;

      const TAU = 0.18;
      const alpha = 1 - Math.exp(-dtSec / Math.max(1e-6, TAU));

      if (Number.isFinite(rawTarget)) {
        if (!Number.isFinite(targetDispRef.current)) targetDispRef.current = rawTarget;
        targetDispRef.current += (rawTarget - targetDispRef.current) * alpha;
      }

      if (Number.isFinite(rawTol)) {
        if (!Number.isFinite(tolDispRef.current)) tolDispRef.current = rawTol;
        tolDispRef.current += (rawTol - tolDispRef.current) * alpha;
      }

      const tDisp = targetDispRef.current;
      const tolDisp = Math.max(0, tolDispRef.current || 0);

      // Ensure band/line inside visible range
      if (Number.isFinite(tDisp)) {
        bottom = Math.min(bottom, tDisp - tolDisp - 0.6);
        top = Math.max(top, tDisp + tolDisp + 0.6);
      }

      const lufsToY = (lufs: number) => {
        const clamped = Math.max(bottom, Math.min(top, lufs));
        const norm = (clamped - bottom) / Math.max(1e-6, top - bottom);
        return h - norm * h;
      };

      // ===== Problem Highlight Bands (behind everything) =====
      segsRef.current = buildProblemSegments(data, tDisp, tolDisp, segsRef.current, {
        minLen: 3,
        gapMerge: 1,
      });

      // build clickable hitboxes from segsRef (no allocations)
      {
        const segs = segsRef.current;
        let clicks = ensureClickSegCapacity(clickSegRef.current, Math.max(32, segs.count));
        clicks.count = 0;

        const padSamples = 1; // must match drawProblemBands pad

        for (let s = 0; s < segs.count; s++) {
          let i0 = segs.starts[s] - padSamples;
          let i1 = segs.ends[s] + padSamples;
          if (i0 < 0) i0 = 0;
          if (i1 > data.length - 1) i1 = data.length - 1;

          const x0 = xOfT(data[i0].t);
          const x1 = xOfT(data[i1].t);

          const left = Math.max(0, Math.min(w, x0));
          const right = Math.max(0, Math.min(w, x1));
          if (right <= left) continue;

          const k = clicks.count++;
          clicks.x0[k] = left;
          clicks.x1[k] = right;
          clicks.startT[k] = data[i0].t;
          clicks.endT[k] = data[i1].t;
        }

        clickSegRef.current = clicks;
      }

      drawProblemBands(ctx, data, segsRef.current, w, h, theme, {
        padSamples: 1,
        opacityDark: 0.10,
        opacityLight: 0.10,
      });

      // ===== Target Zone Band (above problem highlights) =====
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
        ctx.fillRect(0, y, w, hh);
        ctx.restore();
      }

      // ===== Dashed Target Line =====
      if (Number.isFinite(tDisp)) {
        const yT = lufsToY(tDisp);
        const pulsing = performance.now() < pulseUntilRef.current;

        ctx.save();
        ctx.strokeStyle = `rgb(${accentRgb.r} ${accentRgb.g} ${accentRgb.b})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.globalAlpha = pulsing ? 0.85 : 0.6;

        ctx.beginPath();
        ctx.moveTo(0, yT);
        ctx.lineTo(w, yT);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();
      }

      // ===== Curves (Front) =====
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgb(${accentRgb.r} ${accentRgb.g} ${accentRgb.b})`;

      // Short-Term (strong)
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = xOfT(data[i].t);
        const y = lufsToY(data[i].st);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Momentary (softer)
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = xOfT(data[i].t);
        const y = lufsToY(data[i].m);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Playhead (top overlay)
      ctx.globalAlpha = 0.9;
      const ph = getPlayheadTime();
      const xPh = xOfT(ph);
      ctx.beginPath();
      ctx.moveTo(xPh, 0);
      ctx.lineTo(xPh, h);
      ctx.stroke();

      ctx.globalAlpha = 1;

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
    theme,
    getSnapshot,
    getPlayheadTime,
    uiHz,
    accentRgb.r,
    accentRgb.g,
    accentRgb.b,
    targetLUFS,
    toleranceLU,
  ]);

  // ================= POINTER HANDLING =================

  const handlePointer = (clientX: number, shiftKey: boolean) => {
    const c = canvasRef.current;
    if (!c) return;

    const rect = c.getBoundingClientRect();
    const x = clientX - rect.left;

    // 1) Problem-segment navigation first
    const clicks = clickSegRef.current;
    for (let i = 0; i < clicks.count; i++) {
      if (x >= clicks.x0[i] && x <= clicks.x1[i]) {
        onSeekSeconds(shiftKey ? clicks.endT[i] : clicks.startT[i]);
        return;
      }
    }

    // 2) fallback: normal timeline seek
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / rect.width));
    onSeekSeconds(ratio * totalSeconds);
  };

  // ================= RENDER =================

  return (
    <div className={`w-full rounded-2xl ${ui.cardB} p-4 sm:p-5`}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: 120,
          display: "block",
          cursor: "ew-resize",
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          const c = canvasRef.current;
          if (!c) return;

          draggingRef.current = true;
          pointerIdRef.current = e.pointerId;

          try {
            c.setPointerCapture(e.pointerId);
          } catch {}

          handlePointer(e.clientX, e.shiftKey);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          if (pointerIdRef.current !== e.pointerId) return;
          handlePointer(e.clientX, e.shiftKey);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current === e.pointerId) {
            draggingRef.current = false;
            pointerIdRef.current = null;
          }
          const c = canvasRef.current;
          if (!c) return;
          try {
            c.releasePointerCapture(e.pointerId);
          } catch {}
        }}
        onPointerCancel={(e) => {
          if (pointerIdRef.current === e.pointerId) {
            draggingRef.current = false;
            pointerIdRef.current = null;
          }
          const c = canvasRef.current;
          if (!c) return;
          try {
            c.releasePointerCapture(e.pointerId);
          } catch {}
        }}
      />

      <div className="mt-2 text-xs opacity-70">Short-Term (3s) + Momentary (400ms)</div>
    </div>
  );
}