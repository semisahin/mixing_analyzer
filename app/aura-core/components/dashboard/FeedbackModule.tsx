"use client";

import React from "react";
import type { Theme } from "../../lib/types";

export type DiagnosticStatus = "OK" | "Warning" | "Risk";

type Props = {
  theme: Theme;
  title: string;
  status: DiagnosticStatus;
  reason: string; // max 1 sentence
  details?: string[]; // optional expand
};

function toneForStatus(theme: Theme, s: DiagnosticStatus) {
  // Neutral high-contrast (NOT accent-based)
  if (theme === "dark") {
    if (s === "OK") return "text-white border-white/20 bg-white/5";
    if (s === "Warning") return "text-white border-white/30 bg-white/5";
    return "text-white border-white/40 bg-white/5";
  }
  if (s === "OK") return "text-black border-black/20 bg-black/5";
  if (s === "Warning") return "text-black border-black/30 bg-black/5";
  return "text-black border-black/40 bg-black/5";
}

function muted(theme: Theme) {
  return theme === "dark" ? "text-white/65" : "text-black/65";
}

function strong(theme: Theme) {
  return theme === "dark" ? "text-white" : "text-black";
}

export default function FeedbackModule({ theme, title, status, reason, details }: Props) {
  const hasDetails = Array.isArray(details) && details.length > 0;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${theme === "dark" ? "border-white/10" : "border-black/10"}`}>
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 inline-flex items-center justify-center h-6 px-2 rounded-lg text-[10px] font-black uppercase tracking-[0.22em] border ${toneForStatus(
            theme,
            status
          )}`}
        >
          {status}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[11px] font-black uppercase tracking-[0.28em] ${strong(theme)}`}>{title}</p>
            {hasDetails && (
              <span className={`text-[10px] font-mono uppercase tracking-[0.22em] ${muted(theme)}`}>details</span>
            )}
          </div>

          <p className={`mt-1 text-sm font-medium leading-snug ${muted(theme)}`}>{reason || "—"}</p>

          {hasDetails && (
            <details className="mt-2">
              <summary
                className={`cursor-pointer select-none text-[11px] font-black uppercase tracking-[0.22em] ${
                  theme === "dark" ? "text-white/70 hover:text-white" : "text-black/70 hover:text-black"
                }`}
              >
                Expand
              </summary>
              <ul className={`mt-2 space-y-1 text-[12px] leading-snug ${muted(theme)}`}>
                {details!.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="opacity-60">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}