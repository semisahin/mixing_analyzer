import type { Theme, UiTokens } from "../../lib/types";

export function buildUiTokens(theme: Theme): UiTokens {
  return {
    appBg: theme === "dark" ? "bg-[#020202] text-slate-100" : "bg-[#f6f7f8] text-[#0b0b0b]",
    cardA: theme === "dark" ? "bg-[#0a0a0a] border border-white/5" : "bg-white border border-black/10",
    cardB: theme === "dark" ? "bg-black/60 border border-white/5" : "bg-white/80 border border-black/10",
    cardC: theme === "dark" ? "bg-[#0b0b0b] border border-white/5" : "bg-white border border-black/10",
    cardRight: theme === "dark" ? "bg-[#0f0f0f] border border-white/5" : "bg-white border border-black/10",
    subtleText: theme === "dark" ? "text-slate-500" : "text-black/50",
    softText: theme === "dark" ? "text-slate-400" : "text-black/60",
    waveCursor: theme === "dark" ? "bg-white" : "bg-black",

    accentText: "text-[rgb(var(--accent-rgb))]",
    accentBg: "bg-[rgb(var(--accent-rgb))]",
    accentBgSoft: "bg-[rgb(var(--accent-rgb)/0.10)]",
    accentBgSofter: "bg-[rgb(var(--accent-rgb)/0.06)]",
    accentBorder: "border-[rgb(var(--accent-rgb)/0.28)]",
    accentBorderStrong: "border-[rgb(var(--accent-rgb)/0.45)]",
    accentGlow: "shadow-[0_0_30px_rgb(var(--accent-rgb)/0.45)]",
    accentGlowSoft: "shadow-[0_0_50px_rgb(var(--accent-rgb)/0.35)]",
    accentGlowLine: "shadow-[0_0_25px_rgb(var(--accent-rgb)/0.85)]",
  };
}