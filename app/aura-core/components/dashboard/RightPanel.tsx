"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Theme, UiTokens, TargetProfileId } from "../../lib/types";
import { TARGET_PROFILES } from "../../lib/targets";

type Props = {
  theme: Theme;
  ui: UiTokens;
  rmsDb: number;
  truePeakDb: number;
  cGonio: RefObject<HTMLCanvasElement | null>;

  targetProfileId: TargetProfileId;
  onChangeTargetProfileId: (id: TargetProfileId) => void;

  customTargetLUFS: number;
  onChangeCustomTargetLUFS: (v: number) => void;

  resolvedTargetLUFS: number;

  // Stereo Imager (read-only UI)
  stereoWidth?: number; // 0..1
  correlation?: number; // -1..+1 (optional)
};

export default function RightPanel({
  theme,
  ui,
  rmsDb,
  truePeakDb,
  cGonio,
  targetProfileId,
  onChangeTargetProfileId,
  customTargetLUFS,
  onChangeCustomTargetLUFS,
  resolvedTargetLUFS,
  stereoWidth,
  correlation,
}: Props) {
  // Clamp (UI safety)
  const w01 = Number.isFinite(stereoWidth as number)
    ? Math.min(1, Math.max(0, stereoWidth as number))
    : null;

  const corr = Number.isFinite(correlation as number)
    ? Math.min(1, Math.max(-1, correlation as number))
    : null;

  // ===== Mono compatibility interpretation (UI-only, stabilized) =====
  const [monoStatus, setMonoStatus] = useState<"safe" | "watch" | "risk" | null>(null);

  // Smooth correlation for STATUS ONLY (do not affect numeric display)
  const corrSmoothRef = useRef<number>(0);

  // Candidate gating (debounce/hold)
  const candidateRef = useRef<"safe" | "watch" | "risk" | null>(null);
  const candidateSinceRef = useRef<number>(0);

  // Last committed status (avoid redundant setState)
  const lastCommittedRef = useRef<"safe" | "watch" | "risk" | null>(null);

  useEffect(() => {
    if (corr == null) {
      setMonoStatus(null);
      corrSmoothRef.current = 0;
      candidateRef.current = null;
      candidateSinceRef.current = 0;
      lastCommittedRef.current = null;
      return;
    }

    // 1) EMA smoothing (status only)
    const alpha = 0.18;
    const prevSmooth = corrSmoothRef.current;
    const smooth = prevSmooth + alpha * (corr - prevSmooth);
    corrSmoothRef.current = smooth;

    // 2) thresholds
    const next =
      smooth > 0.2 ? ("safe" as const) : smooth >= 0 ? ("watch" as const) : ("risk" as const);

    // 3) hold
    const now = performance.now();
    if (candidateRef.current !== next) {
      candidateRef.current = next;
      candidateSinceRef.current = now;
      return;
    }

    const holdMs = 250;
    if (now - candidateSinceRef.current < holdMs) return;

    if (lastCommittedRef.current !== next) {
      lastCommittedRef.current = next;
      setMonoStatus(next);
    }
  }, [corr]);

  const monoLabel =
    monoStatus === "safe" ? "Mono Safe" : monoStatus === "watch" ? "Watch" : "Mono Risk";

  const monoPillTone =
    monoStatus === "safe"
      ? "border-[rgb(var(--accent-rgb)/0.28)] bg-[rgb(var(--accent-rgb)/0.08)]"
      : monoStatus === "watch"
        ? "border-[rgb(var(--accent-rgb)/0.20)] bg-[rgb(var(--accent-rgb)/0.06)]"
        : "border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.07)]";

  const surface = theme === "dark" ? "border-white/10 bg-black/30" : "border-black/10 bg-black/5";
  const cardSurface = theme === "dark" ? "border-white/10 bg-black/20" : "border-black/10 bg-black/5";

  return (
    <div
      className={`${ui.cardRight} rounded-[3rem] p-8 sm:p-10 lg:p-12 shadow-2xl border ${
        theme === "dark" ? "border-white/10" : "border-black/10"
      } flex flex-col gap-6`}
    >
      {/* Title (centered) */}
      <div className="text-center">
        <p
          className={`text-sm font-black uppercase tracking-widest italic underline decoration-[rgb(var(--accent-rgb)/0.35)] ${
            ui.subtleText
          }`}
        >
          Stereo Image
        </p>
      </div>

      {/* Target Profile */}
      <div className={`rounded-2xl border p-4 ${cardSurface}`}>
        <p className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${ui.subtleText}`}>Target Profile</p>

        <select
          className={`w-full rounded-xl px-3 py-2 text-sm ${
            theme === "dark"
              ? "bg-black/40 border border-white/10 text-white"
              : "bg-white border border-black/10 text-black"
          }`}
          value={targetProfileId}
          onChange={(e) => onChangeTargetProfileId(e.target.value as TargetProfileId)}
        >
          {TARGET_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {targetProfileId === "custom" && (
          <input
            className={`mt-2 w-full rounded-xl px-3 py-2 text-sm ${
              theme === "dark"
                ? "bg-black/40 border border-white/10 text-white"
                : "bg-white border border-black/10 text-black"
            }`}
            type="number"
            step="0.1"
            value={customTargetLUFS}
            onChange={(e) => onChangeCustomTargetLUFS(Number(e.target.value))}
          />
        )}

        <div className={`mt-2 text-xs ${theme === "dark" ? "text-white/60" : "text-black/50"}`}>
          Target: <span className="font-mono tabular-nums">{resolvedTargetLUFS.toFixed(1)} LUFS</span>
        </div>
      </div>

      {/* RMS / True Peak */}
      <div className="w-full grid grid-cols-2 gap-3 items-stretch">
        <div className={`rounded-xl border p-3 text-center flex flex-col justify-center ${surface}`}>
          <p className={`text-[10px] uppercase tracking-[0.2em] ${ui.subtleText}`}>RMS</p>
          <p className={`mt-1 text-base font-mono tabular-nums ${ui.accentText}`}>
            <span className="inline-block min-w-[7ch]">{rmsDb.toFixed(1)}</span> dB
          </p>
        </div>

        <div className={`rounded-xl border p-3 text-center flex flex-col justify-center ${surface}`}>
          <p className={`text-[10px] uppercase tracking-[0.2em] ${ui.subtleText}`}>True Peak</p>
          <p className={`mt-1 text-base font-mono tabular-nums ${theme === "dark" ? "text-white" : "text-black"}`}>
            <span className="inline-block min-w-[7ch]">{truePeakDb.toFixed(1)}</span> dBFS
          </p>
        </div>
      </div>

      {/* Goniometer (perfect circle + slightly smaller scale) */}
      <div className="w-full flex justify-center">
        <div
          className={`w-full max-w-[400px] aspect-square rounded-full overflow-hidden relative flex items-center justify-center ${
            theme === "dark" ? "bg-black border border-white/5" : "bg-white border border-black/10"
          } shadow-[0_0_45px_rgb(var(--accent-rgb)/0.10)]`}
        >
          <canvas
            ref={cGonio}
            className="w-full h-full block"
            style={{ borderRadius: 9999 }}
            width={360}
            height={360}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--accent-rgb)/0.08)] to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Stereo strip (Mono inside same frame) */}
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between">
          <p className={`text-[10px] uppercase tracking-[0.2em] ${ui.subtleText}`}>Stereo Width</p>
          <p className={`text-xs font-mono tabular-nums ${theme === "dark" ? "text-white/70" : "text-black/60"}`}>
            {w01 == null ? "--" : `${Math.round(w01 * 100)}%`}
          </p>
        </div>

        <div className="mt-2 h-2 rounded-full overflow-hidden border border-[rgb(var(--accent-rgb)/0.18)] bg-[rgb(var(--accent-rgb)/0.06)]">
          <div
            className="h-full rounded-full bg-[rgb(var(--accent-rgb)/0.85)] shadow-[0_0_18px_rgb(var(--accent-rgb)/0.18)]"
            style={{ width: `${w01 == null ? 0 : Math.round(w01 * 100)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className={`text-[10px] uppercase tracking-[0.2em] ${ui.subtleText}`}>Correlation</p>
          <p className={`text-xs font-mono tabular-nums ${theme === "dark" ? "text-white/70" : "text-black/60"}`}>
            {corr == null ? "--" : corr.toFixed(2)}
          </p>
        </div>

        {/* Mono Compatibility (inside same frame) */}
        <div className="mt-3 flex items-center justify-between">
          <p className={`text-[10px] uppercase tracking-[0.2em] ${ui.subtleText}`}>Mono Compatibility</p>
          <div
            className={`text-[11px] font-mono tabular-nums px-2 py-[3px] rounded-full border ${monoPillTone}`}
            style={{ color: "rgb(var(--accent-rgb))" }}
          >
            {monoStatus == null ? "--" : monoLabel}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`w-full pt-6 border-t text-center ${theme === "dark" ? "border-white/5" : "border-black/10"}`}>
        <p className={`text-xs font-mono uppercase tracking-[0.4em] ${theme === "dark" ? "text-slate-700" : "text-black/40"}`}>
          Signal Integrity Verified
        </p>
      </div>
    </div>
  );
}