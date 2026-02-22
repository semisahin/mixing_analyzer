"use client";

import type { UiTokens, Theme } from "../../lib/types";
import type { RefObject } from "react";

type Props = {
  ui: UiTokens;
  theme: Theme;
  accentHex: string;

  url: string | null;
  time: { current: number; total: number };

  waveWrapRef: RefObject<HTMLDivElement | null>;
  cWave: RefObject<HTMLCanvasElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;

  seekFromClientX: (clientX: number) => void;
  onEnded: () => void;
  onPause: () => void;
  onPlay: () => void;
};

function normalizeHex(input: string) {
  let v = input.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v.toLowerCase();
}

function getCursorColor(theme: Theme, accentHex: string) {
  const a = normalizeHex(accentHex);
  const isAccentWhite = a === "#ffffff";
  const isAccentBlack = a === "#000000";

  // default per theme
  let cursor = theme === "dark" ? "#ffffff" : "#000000";

  // exceptions
  if (theme === "dark" && isAccentWhite) cursor = "#000000";
  if (theme === "light" && isAccentBlack) cursor = "#ffffff";

  return cursor;
}

export default function WaveformCard({
  ui,
  theme,
  accentHex,
  url,
  time,
  waveWrapRef,
  cWave,
  audioRef,
  seekFromClientX,
  onEnded,
  onPause,
  onPlay,
}: Props) {
  const cursorColor = getCursorColor(theme, accentHex);

  // extra: make it readable on any waveform by adding a subtle opposite “keyline”
  const keylineColor = cursorColor === "#ffffff" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";

  return (
    <div className={`${ui.cardB} rounded-[3rem] relative overflow-hidden shadow-2xl z-0 h-32 sm:h-36 lg:h-40`}>
      <div
        ref={waveWrapRef}
        className="absolute inset-0 cursor-ew-resize"
        onClick={(e) => seekFromClientX(e.clientX)}
        onMouseMove={(e) => {
          if (e.buttons === 1) seekFromClientX(e.clientX);
        }}
      />

      <canvas ref={cWave} className="w-full h-full" width={920} height={240} />

      {/* Playhead / Fader */}
      <div
        className="absolute top-0 bottom-0 w-[2px] z-10 pointer-events-none"
        style={{
          left: `${time.total ? (time.current / time.total) * 100 : 0}%`,
          backgroundColor: cursorColor,
          boxShadow: `0 0 0 1px ${keylineColor}`, // crisp edge on both dark/light waveforms
          opacity: 0.95,
        }}
      />

      {url && (
        <audio ref={audioRef} src={url} className="hidden" onEnded={onEnded} onPause={onPause} onPlay={onPlay} />
      )}
    </div>
  );
}