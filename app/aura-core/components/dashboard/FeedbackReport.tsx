"use client";

import React, { useMemo, useRef, useState } from "react";
import type { Theme, UiTokens, Rgb } from "../../lib/types";

type State = "ok" | "warn" | "fail";

type Props = {
  theme: Theme;
  ui: UiTokens;
  accentRgb: Rgb;

  averageLufs: number;
  targetLUFS: number;
  toleranceLU: number;

  truePeakDb: number;
  correlation: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmt1(n: number) {
  if (!Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(1)}`;
}

function verdictIcon(state: State) {
  if (state === "ok") return "✓";
  if (state === "warn") return "⚠";
  return "✕";
}

function verdictLabel(state: State) {
  if (state === "ok") return "STREAMING READY";
  if (state === "warn") return "NEEDS ADJUSTMENT";
  return "MASTER RISK";
}

function rowIcon(state: State) {
  if (state === "ok") return "✓";
  if (state === "warn") return "⚠";
  return "✕";
}

function StatusRow({
  label,
  state,
  message,
  accentRgb,
}: {
  label: string;
  state: State;
  message: React.ReactNode;
  accentRgb: Rgb;
}) {
  const accent = `rgb(${accentRgb.r} ${accentRgb.g} ${accentRgb.b})`;
  const rightColor = state === "ok" ? undefined : accent;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="text-[11px] tracking-[0.18em] uppercase opacity-80">{label}</div>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={rightColor ? { color: rightColor } : undefined}>
          {rowIcon(state)}
        </span>
        <div className="text-sm text-right" style={rightColor ? { color: rightColor } : undefined}>
          {message}
        </div>
      </div>
    </div>
  );
}

// --------- Stability helpers (no extra renders; latches only within existing renders) ---------
const HOLD_MS = 650; // needs to feel stable but still responsive (~300ms target; 650ms removes flicker)
type Key = "loudness" | "truePeak" | "stereo" | "verdict";

type Latch = {
  stable: State;
  pending: State;
  pendingSince: number;
};

function priority(s: State) {
  if (s === "fail") return 2;
  if (s === "warn") return 1;
  return 0;
}

export default function FeedbackReport({
  theme,
  ui,
  accentRgb,

  averageLufs,
  targetLUFS,
  toleranceLU,

  truePeakDb,
  correlation,
}: Props) {
  const [openWhy, setOpenWhy] = useState(false);

  // Per-metric latches (persist across renders)
  const latchRef = useRef<Record<Key, Latch>>({
    loudness: { stable: "ok", pending: "ok", pendingSince: 0 },
    truePeak: { stable: "ok", pending: "ok", pendingSince: 0 },
    stereo: { stable: "ok", pending: "ok", pendingSince: 0 },
    verdict: { stable: "ok", pending: "ok", pendingSince: 0 },
  });

  const derived = useMemo(() => {
    const now = performance.now();

    // ---- HYSTERESIS VALUES (tuned to stop edge flapping) ----
    // Loudness: small deadband around tol
    const tol = Math.max(0, toleranceLU || 0);
    const LOUD_HYST = 0.25; // LU deadband
    // True peak: deadband around -1.0 dBTP
    const TP_LIMIT = -1.0;
    const TP_HYST = 0.2; // dB
    // Stereo: deadband around 0 correlation
    const CORR_LIMIT = 0.0;
    const CORR_HYST = 0.05;

    const diff = averageLufs - targetLUFS;

    // ----- RAW STATES (with hysteresis) -----
    // Loudness:
    // ok if inside tol-LOUD_HYST
    // warn if outside tol-LOUD_HYST but not "far"
    // fail if far outside (tol*2 + LOUD_HYST)
    let loudnessStateRaw: State = "ok";
    if (Number.isFinite(diff) && Number.isFinite(tol)) {
      const ad = Math.abs(diff);
      const okThresh = Math.max(0, tol - LOUD_HYST);
      const failThresh = tol * 2.0 + LOUD_HYST;

      if (ad <= okThresh) loudnessStateRaw = "ok";
      else if (ad >= failThresh) loudnessStateRaw = "fail";
      else loudnessStateRaw = "warn";
    } else {
      loudnessStateRaw = "warn";
    }

    const loudnessMsg =
      loudnessStateRaw === "ok" ? (
        "On target"
      ) : (
        <span>
          <span className="font-mono">{fmt1(diff)}</span> LU {diff >= 0 ? "above" : "below"} target
        </span>
      );

    // True Peak:
    // ok if <= (TP_LIMIT - TP_HYST)
    // warn if between (TP_LIMIT - TP_HYST) and 0
    // fail if > 0
    let truePeakStateRaw: State = "ok";
    if (Number.isFinite(truePeakDb)) {
      if (truePeakDb <= TP_LIMIT - TP_HYST) truePeakStateRaw = "ok";
      else if (truePeakDb > 0.0) truePeakStateRaw = "fail";
      else truePeakStateRaw = "warn";
    } else {
      truePeakStateRaw = "warn";
    }

    const truePeakMsg =
      truePeakStateRaw === "ok" ? (
        "Safe"
      ) : truePeakStateRaw === "warn" ? (
        <span>
          <span className="font-mono">{truePeakDb.toFixed(1)}</span> dBTP (aim ≤{" "}
          <span className="font-mono">-1.0</span>)
        </span>
      ) : (
        <span>
          <span className="font-mono">{truePeakDb.toFixed(1)}</span> dBTP (clipping risk)
        </span>
      );

    // Stereo (correlation):
    // ok if > (0 + CORR_HYST)
    // warn if between [-0.2, 0 + CORR_HYST]
    // fail if <= -0.2
    let stereoStateRaw: State = "ok";
    if (Number.isFinite(correlation)) {
      if (correlation > CORR_LIMIT + CORR_HYST) stereoStateRaw = "ok";
      else if (correlation <= -0.2) stereoStateRaw = "fail";
      else stereoStateRaw = "warn";
    } else {
      stereoStateRaw = "warn";
    }

    const stereoMsg =
      stereoStateRaw === "ok" ? (
        "Mono compatible"
      ) : stereoStateRaw === "warn" ? (
        <span>
          <span className="font-mono">{correlation.toFixed(2)}</span> correlation (mono risk)
        </span>
      ) : (
        <span>
          <span className="font-mono">{correlation.toFixed(2)}</span> correlation (phase risk)
        </span>
      );

    // ---- LATCH FUNCTION (holds state until change persists HOLD_MS) ----
    const latch = (key: Key, raw: State) => {
      const L = latchRef.current[key];

      // If raw == stable, reset pending and keep stable
      if (raw === L.stable) {
        L.pending = raw;
        L.pendingSince = 0;
        return L.stable;
      }

      // If raw has higher severity than stable: upgrade fast (no hold)
      if (priority(raw) > priority(L.stable)) {
        L.stable = raw;
        L.pending = raw;
        L.pendingSince = 0;
        return L.stable;
      }

      // raw is less severe than stable: require HOLD_MS stability to downgrade
      if (L.pending !== raw) {
        L.pending = raw;
        L.pendingSince = now;
        return L.stable;
      }

      // pending same raw; check hold duration
      if (L.pendingSince > 0 && now - L.pendingSince >= HOLD_MS) {
        L.stable = raw;
        L.pendingSince = 0;
      }

      return L.stable;
    };

    const loudnessState = latch("loudness", loudnessStateRaw);
    const truePeakState = latch("truePeak", truePeakStateRaw);
    const stereoState = latch("stereo", stereoStateRaw);

    // Verdict from latched states (so count is stable too)
    const anyFail = loudnessState === "fail" || truePeakState === "fail" || stereoState === "fail";
    const anyWarn = loudnessState === "warn" || truePeakState === "warn" || stereoState === "warn";
    const verdictRaw: State = anyFail ? "fail" : anyWarn ? "warn" : "ok";
    const verdict = latch("verdict", verdictRaw);

    const issueCount =
      (loudnessState === "ok" ? 0 : 1) +
      (truePeakState === "ok" ? 0 : 1) +
      (stereoState === "ok" ? 0 : 1);

    return {
      tol,
      diff,

      loudnessState,
      loudnessMsg,

      truePeakState,
      truePeakMsg,

      stereoState,
      stereoMsg,

      verdict,
      issueCount,
    };
  }, [averageLufs, targetLUFS, toleranceLU, truePeakDb, correlation]);

  const accent = `rgb(${accentRgb.r} ${accentRgb.g} ${accentRgb.b})`;
  const verdictColor = derived.verdict === "ok" ? undefined : accent;

  const issueText =
    derived.issueCount === 0
      ? "0 ISSUES DETECTED"
      : `${derived.issueCount} ISSUE${derived.issueCount === 1 ? "" : "S"} DETECTED`;

  return (
    <div className={`w-full rounded-2xl ${ui.cardB} p-4 sm:p-5`}>
      {/* MASTER VERDICT */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.18em] uppercase opacity-75">MASTER STATUS</div>

          <div
            className="mt-1 text-xl sm:text-2xl font-semibold leading-tight"
            style={verdictColor ? { color: verdictColor } : undefined}
          >
            <span className="mr-2">{verdictIcon(derived.verdict)}</span>
            {verdictLabel(derived.verdict)}
          </div>

          <div className="mt-1 text-xs opacity-75">
            <span style={derived.issueCount > 0 ? { color: accent } : undefined}>{issueText}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenWhy((v) => !v)}
          className="text-xs tracking-wide opacity-80 hover:opacity-100 select-none"
          style={openWhy ? { color: accent } : undefined}
        >
          {openWhy ? "HIDE" : "WHY?"}
        </button>
      </div>

      <div className="mt-3 border-t border-black/10 dark:border-white/10" />

      <div className="mt-2">
        <StatusRow label="LOUDNESS" state={derived.loudnessState} message={derived.loudnessMsg} accentRgb={accentRgb} />
        <div className="border-t border-black/10 dark:border-white/10" />
        <StatusRow label="TRUE PEAK" state={derived.truePeakState} message={derived.truePeakMsg} accentRgb={accentRgb} />
        <div className="border-t border-black/10 dark:border-white/10" />
        <StatusRow label="STEREO" state={derived.stereoState} message={derived.stereoMsg} accentRgb={accentRgb} />
      </div>

      {openWhy && (
        <div className="mt-3 border-t border-black/10 dark:border-white/10 pt-3 text-xs leading-relaxed opacity-80">
          <div className="space-y-2">
            <div>
              <span className="uppercase tracking-[0.18em] opacity-80">Loudness</span>: Target{" "}
              <span className="font-mono">{Number.isFinite(targetLUFS) ? targetLUFS.toFixed(1) : "—"}</span> LUFS ±{" "}
              <span className="font-mono">{clamp(toleranceLU, 0, 99).toFixed(1)}</span> LU. Average is{" "}
              <span className="font-mono">{Number.isFinite(averageLufs) ? averageLufs.toFixed(1) : "—"}</span>.
            </div>

            <div>
              <span className="uppercase tracking-[0.18em] opacity-80">True Peak</span>: Recommended ≤{" "}
              <span className="font-mono">-1.0</span> dBTP for streaming headroom.
            </div>

            <div>
              <span className="uppercase tracking-[0.18em] opacity-80">Stereo</span>: Correlation &gt;{" "}
              <span className="font-mono">0.00</span> suggests safer mono compatibility.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}