"use client";

import type { Theme, UiTokens } from "../lib/types";

type Props = {
  stage: "upload";
  theme: Theme;
  ui: UiTokens;
  toggleTheme: () => void;
  onUpload: (file: File) => void;
  accentHex: string;
};

function normalizeHex(input: string) {
  let v = input.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v.toLowerCase();
}

function getBadgeTextColor(theme: Theme, accentHex: string) {
  const a = normalizeHex(accentHex);
  const isAccentWhite = a === "#ffffff";
  const isAccentBlack = a === "#000000";

  let text = theme === "dark" ? "text-white" : "text-black";
  if (theme === "light" && isAccentBlack) text = "text-white";
  if (theme === "dark" && isAccentWhite) text = "text-black";
  return text;
}

export default function UploadStage({ theme, ui, toggleTheme, onUpload, accentHex }: Props) {
  const badgeTextTone = getBadgeTextColor(theme, accentHex);

  const contrastHover =
    theme === "dark"
      ? "hover:ring-2 hover:ring-inset hover:ring-white/35 hover:bg-white/[0.06]"
      : "hover:ring-2 hover:ring-inset hover:ring-black/35 hover:bg-black/[0.06]";

  const focus =
    theme === "dark"
      ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/45"
      : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/45";

  const btnBase =
    "h-10 px-6 rounded-2xl inline-flex items-center justify-center " +
    "text-xs font-black uppercase tracking-[0.22em] leading-[1] whitespace-nowrap " +
    "transition-colors border ring-0 shadow-none";

  const btnTone =
    theme === "dark"
      ? `border-white/10 text-slate-200 bg-black/30`
      : `border-black/10 text-black bg-white`;

  return (
    <div className="flex-grow w-full max-w-[1200px] flex flex-col items-center justify-center animate-in fade-in duration-700 relative">
      <div className="absolute top-0 right-0">
        <button onClick={toggleTheme} className={`${btnBase} ${btnTone} ${contrastHover} ${focus}`}>
          {theme === "dark" ? "Dark" : "Light"}
        </button>
      </div>

      <div
        className={`w-24 h-24 rounded-[2rem] mb-12 flex items-center justify-center font-black text-4xl italic ${badgeTextTone} ${ui.accentBg} ${ui.accentGlowSoft}`}
      >
        A
      </div>

      <label className="cursor-pointer group flex flex-col items-center gap-4">
        <span
          className={`text-lg tracking-[0.4em] font-black uppercase underline underline-offset-[12px] transition-colors ${ui.accentText} group-hover:text-white`}
        >
          Select Audio Master
        </span>
        <span className={`text-xs tracking-[0.25em] uppercase ${ui.subtleText}`}>
          Upload starts analysis and unlocks the dashboard
        </span>
        <input
          type="file"
          className="hidden"
          accept="audio/*"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </label>
    </div>
  );
}