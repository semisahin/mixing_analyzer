"use client";

import { useRef } from "react";
import type { Theme, UiTokens, Rgb } from "../../lib/types";
import AccentPanel from "./AccentPanel";

type Props = {
  theme: Theme;
  ui: UiTokens;

  isPlaying: boolean;
  togglePlayback: () => void;

  volume: number;
  setVolume: (v: number) => void;

  liveLufs: number;
  averageLufs: number;

  targetLUFS: number;
  toleranceLU: number;

  toggleTheme: () => void;

  onUploadFile?: (file: File) => void;

  isAccentOpen: boolean;
  setIsAccentOpen: (updater: (v: boolean) => boolean) => void;

  accentRgb: Rgb;

  fileInfo: { name: string; size: string };

  accentHex: string;
  accentDraft: string;
  setAccentDraft: (v: string) => void;
  accentError: string | null;
  setAccentError: (v: string | null) => void;

  applyAccent: (hex: string) => boolean;

  accentPresets: string[];
  recentAccents: string[];

  accentPanelTone: string;
  accentInputTone: string;
  accentHintTone: string;

  headerZ: string;
  accentPanelZ: string;

  // ✅ NEW
  onOpenHelp: () => void;
};

export default function HeaderBar(props: Props) {
  const {
    theme,
    ui,
    isPlaying,
    togglePlayback,
    volume,
    setVolume,
    liveLufs,
    averageLufs,

    targetLUFS,
    toleranceLU,

    toggleTheme,
    onUploadFile,

    isAccentOpen,
    setIsAccentOpen,
    accentRgb,
    fileInfo,
    accentHex,
    accentDraft,
    setAccentDraft,
    accentError,
    setAccentError,
    applyAccent,
    accentPresets,
    recentAccents,
    accentPanelTone,
    accentInputTone,
    accentHintTone,
    headerZ,
    accentPanelZ,

    // ✅ NEW
    onOpenHelp,
  } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const accentIsDark = accentRgb.r * 0.299 + accentRgb.g * 0.587 + accentRgb.b * 0.114 < 140;
  const playText = accentIsDark ? "text-white" : "text-black";

  const deltaLU = averageLufs - targetLUFS;
  const deltaText =
    !Number.isFinite(deltaLU)
      ? "--"
      : deltaLU < 0
        ? `Δ ${deltaLU.toFixed(1)} LU below target`
        : `Δ +${deltaLU.toFixed(1)} LU above target`;

  const handleUploadPicked = (file: File) => {
    if (typeof onUploadFile === "function") {
      onUploadFile(file);
      return;
    }
    console.warn("[AuraCore] onUploadFile is not wired yet. Add it in AuraFinalFixed/page.tsx.");
  };

  // ---------- Hover style: "contrast ring", no glow ----------
  const contrastHover =
    theme === "dark"
      ? "hover:ring-2 hover:ring-inset hover:ring-white/35 hover:bg-white/[0.06]"
      : "hover:ring-2 hover:ring-inset hover:ring-black/35 hover:bg-black/[0.06]";

  const focus =
    theme === "dark"
      ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/45"
      : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/45";

  const btnBase =
    "h-10 min-w-[124px] px-6 rounded-2xl inline-flex items-center justify-center " +
    "text-xs font-black uppercase tracking-[0.22em] leading-[1] whitespace-nowrap " +
    "transition-colors border ring-0 shadow-none";

  const btnTone =
    theme === "dark"
      ? `border-white/10 text-slate-200 bg-black/30`
      : `border-black/10 text-black bg-white`;

  // How To button under title (text-button)
  const howToBase =
    "inline-flex items-center justify-center select-none " +
    "text-[11px] font-black uppercase tracking-[0.28em] " +
    "px-2 py-1 rounded-lg transition-colors whitespace-nowrap";

  const howToTone =
    theme === "dark"
      ? `text-white/75 hover:text-white ${focus}`
      : `text-black/70 hover:text-black ${focus}`;

  const howToUnderline =
    theme === "dark"
      ? "hover:underline hover:underline-offset-4 decoration-white/45"
      : "hover:underline hover:underline-offset-4 decoration-black/45";

  return (
    <div className={`${ui.cardA} rounded-[3rem] p-6 sm:p-8 lg:p-10 shadow-2xl ${headerZ}`}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-start">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            <button
              onClick={togglePlayback}
              className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center transition-all ${
                isPlaying
                  ? `${ui.accentBg} ${playText} ${ui.accentGlow}`
                  : `border-2 ${ui.accentBorderStrong} ${ui.accentText} hover:${ui.accentBgSoft}`
              }`}
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="w-full sm:w-[220px]">
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-[0.35em] ${ui.subtleText}`}>VOLUME</p>
                <p className={`text-[10px] font-mono tracking-[0.25em] ${ui.softText}`}>{(volume * 100).toFixed(0)}%</p>
              </div>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="mt-2 w-full h-2 rounded-full outline-none"
                style={{
                  background: `linear-gradient(to right, rgb(${accentRgb.r},${accentRgb.g},${accentRgb.b}) 0%, rgb(${accentRgb.r},${accentRgb.g},${accentRgb.b}) ${
                    volume * 100
                  }%, ${theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"} ${
                    volume * 100
                  }%, ${theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"} 100%)`,
                }}
              />

              <style jsx>{`
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 9999px;
                  background: rgb(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b});
                  box-shadow: 0 0 18px rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.55);
                  border: 0;
                  cursor: pointer;
                }
                input[type="range"]::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  border-radius: 9999px;
                  background: rgb(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b});
                  box-shadow: 0 0 18px rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.55);
                  border: 0;
                  cursor: pointer;
                }
              `}</style>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            <div className="min-w-[240px]">
              <h2 className={`text-sm font-black uppercase tracking-widest mb-2 ${ui.subtleText}`}>Real-Time LUFS</h2>
              <p className={`text-5xl font-mono font-black ${ui.accentText} tabular-nums`}>{liveLufs.toFixed(1)}</p>
            </div>

            <div className="min-w-[240px]">
              <h2 className={`text-sm font-black uppercase tracking-widest mb-2 ${ui.subtleText}`}>Average LUFS</h2>
              <p className={`text-5xl font-mono font-black ${theme === "dark" ? "text-white" : "text-black"} tabular-nums`}>
                {averageLufs.toFixed(1)}
              </p>

              <div className={`mt-2 text-xs font-mono tabular-nums ${ui.subtleText} opacity-70`}>
                {deltaText}
                <span className="ml-2 opacity-80">
                  (Target {targetLUFS.toFixed(1)} ±{toleranceLU.toFixed(1)} LU)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative w-full lg:w-[360px] lg:justify-self-end">
          <div className="flex items-center justify-end gap-2 flex-nowrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) handleUploadPicked(f);
                e.currentTarget.value = "";
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className={`${btnBase} ${btnTone} ${contrastHover} ${focus}`}
              aria-label="Upload audio"
              title="Upload audio"
            >
              Upload
            </button>

            <button onClick={toggleTheme} className={`${btnBase} ${btnTone} ${contrastHover} ${focus}`}>
              {theme === "dark" ? "Dark" : "Light"}
            </button>

            <button
              onClick={() => setIsAccentOpen((v) => !v)}
              className={`${btnBase} ${ui.accentBorder} ${ui.accentText} ${contrastHover} ${focus}`}
            >
              Accent
            </button>
          </div>

          {isAccentOpen && (
            <div className="relative">
              <AccentPanel
                theme={theme}
                ui={ui}
                isAccentOpen={isAccentOpen}
                setIsAccentOpen={(v) => setIsAccentOpen(() => v)}
                accentHex={accentHex}
                accentDraft={accentDraft}
                setAccentDraft={setAccentDraft}
                accentError={accentError}
                applyAccent={applyAccent}
                accentPresets={accentPresets}
                recentAccents={recentAccents}
                accentPanelTone={accentPanelTone}
                accentInputTone={accentInputTone}
                accentHintTone={accentHintTone}
                accentPanelZ={accentPanelZ}
              />
            </div>
          )}

          <div className="mt-4 text-right">
            <div className="flex items-center justify-end gap-3">
              <p className={`text-lg font-black uppercase tracking-[0.3em] italic ${theme === "dark" ? "text-white" : "text-black"}`}>
                Aura Core v21
              </p>

              <button type="button" onClick={onOpenHelp} className={`${howToBase} ${howToTone} ${howToUnderline}`}>
                How To
              </button>
            </div>

            <p className={`text-sm mt-2 font-bold ${ui.subtleText}`}>
              {fileInfo.name} • {fileInfo.size}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}