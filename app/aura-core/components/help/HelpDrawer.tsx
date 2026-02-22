"use client";

import { useEffect } from "react";
import type { Theme, UiTokens } from "../../lib/types";
import { HELP_SECTIONS } from "./helpContent";

type Props = {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  ui: UiTokens;
};

export default function HelpDrawer({ open, onClose, theme, ui }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const borderTone = theme === "dark" ? "border-white/10" : "border-black/10";
  const overlayTone = theme === "dark" ? "bg-black/40" : "bg-black/20";

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`
          fixed inset-0 z-[900]
          transition-opacity duration-300
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
          ${overlayTone}
        `}
      />

      {/* Drawer */}
      <aside
        className={`
          fixed right-0 top-0 h-full w-[420px] max-w-[90vw]
          z-[901]
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}
          ${ui.cardA}
          border-l ${borderTone}
          flex flex-col overflow-hidden
        `}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={`shrink-0 p-6 border-b ${borderTone} flex justify-between items-center`}>
          <h2 className={`font-black tracking-[0.35em] text-sm ${ui.accentText}`}>HOW TO USE</h2>

          <button onClick={onClose} className={`text-xs font-mono ${ui.subtleText}`}>
            CLOSE
          </button>
        </div>

        {/* Scroll Content (KEY FIX: min-h-0) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-8">
          {HELP_SECTIONS.map((s) => (
            <section key={s.id}>
              <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-3 ${ui.accentText}`}>
                {s.title}
              </h3>

              <p className={`text-sm leading-relaxed whitespace-pre-line ${ui.subtleText}`}>
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}