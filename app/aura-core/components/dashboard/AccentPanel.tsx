"use client";

import type { Theme, UiTokens } from "../../lib/types";
import { isAllowedAccent, normalizeHex } from "../../lib/color";

type Props = {
  theme: Theme;
  ui: UiTokens;

  isAccentOpen: boolean;
  setIsAccentOpen: (v: boolean) => void;

  accentHex: string;
  accentDraft: string;
  setAccentDraft: (v: string) => void;
  accentError: string | null;

  applyAccent: (hex: string) => boolean;

  accentPresets: string[];
  recentAccents: string[];

  accentPanelTone: string;
  accentInputTone: string;
  accentHintTone: string;

  accentPanelZ: string;
};

export default function AccentPanel(props: Props) {
  const {
    theme,
    ui,
    isAccentOpen,
    setIsAccentOpen,
    accentHex,
    setAccentDraft,
    accentError,
    applyAccent,
    accentPresets,
    recentAccents,
    accentPanelTone,
    accentHintTone,
    accentPanelZ,
  } = props;

  if (!isAccentOpen) return null;

  const isActive = (hex: string) => normalizeHex(hex) === normalizeHex(accentHex);

  const chipBorder = (active: boolean) =>
    active
      ? `border-[rgb(var(--accent-rgb))] shadow-[0_0_18px_rgb(var(--accent-rgb)/0.25)]`
      : theme === "dark"
        ? "border-white/10 hover:border-white/20"
        : "border-black/10 hover:border-black/20";

  const safeRecent = recentAccents
    .map(normalizeHex)
    .filter((hex, i, a) => a.indexOf(hex) === i)
    .filter((hex) => isAllowedAccent(hex, theme))
    .slice(0, 8);

  return (
    <div className={`absolute top-[3.2rem] right-0 w-[360px] rounded-[2rem] p-5 ${accentPanelTone} ${accentPanelZ}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-black uppercase tracking-[0.35em] ${ui.accentText}`}>Accent</p>
        <button
          onClick={() => setIsAccentOpen(false)}
          className={`text-xs font-mono ${accentHintTone} hover:${ui.accentText} transition-colors`}
        >
          Close
        </button>
      </div>

      <p className={`mt-3 text-[11px] font-mono ${accentHintTone}`}>
        Presets for {theme === "dark" ? "Dark Mode" : "Light Mode"}.
      </p>

      <div className="mt-5">
        <p className={`text-[10px] font-black uppercase tracking-[0.32em] ${ui.subtleText}`}>Presets</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {accentPresets.map((hex) => {
            const active = isActive(hex);
            return (
              <button
                key={hex}
                onClick={() => {
                  setAccentDraft(hex);
                  applyAccent(hex);
                }}
                className={`h-10 w-10 rounded-xl border transition-all ${chipBorder(active)}`}
                style={{ backgroundColor: normalizeHex(hex) }}
                aria-label={`Set accent ${hex}`}
              />
            );
          })}
        </div>
      </div>

      {safeRecent.length > 0 && (
        <div className="mt-5">
          <p className={`text-[10px] font-black uppercase tracking-[0.32em] ${ui.subtleText}`}>Recent</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {safeRecent.map((hex) => {
              const active = isActive(hex);
              return (
                <button
                  key={hex}
                  onClick={() => {
                    setAccentDraft(hex);
                    applyAccent(hex);
                  }}
                  className={`h-10 w-10 rounded-xl border transition-all ${chipBorder(active)}`}
                  style={{ backgroundColor: hex }}
                  aria-label={`Set accent ${hex}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {accentError && <p className="mt-4 text-[11px] font-mono text-red-400">INVALID: {accentError}</p>}
    </div>
  );
}