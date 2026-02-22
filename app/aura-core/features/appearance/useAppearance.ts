"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Rgb, Theme, UiTokens } from "../../lib/types";
import {
  DEFAULT_THEME,
  getThemeAccent,      // default accent for theme (dark->#fff, light->#000)
  getThemeAccents,     // presets for theme
  hexToRgb,
  isAllowedAccent,
  isValidHex6,
  normalizeHex,
  rgbToCssVar,
} from "../../lib/color";
import { buildUiTokens } from "./uiTokens";

export type AppearanceState = {
  theme: Theme;
  toggleTheme: () => void;

  ui: UiTokens;

  accentHex: string;
  accentDraft: string;
  setAccentDraft: (v: string) => void;

  accentError: string | null;
  setAccentError: (v: string | null) => void;

  isAccentOpen: boolean;
  setIsAccentOpen: Dispatch<SetStateAction<boolean>>;

  recentAccents: string[];
  accentPresets: string[];

  applyAccent: (hex: string) => boolean;

  volume: number;
  setVolume: (v: number) => void;

  accentRgb: Rgb;
  accentRgbRef: React.MutableRefObject<Rgb>;

  accentStyle: CSSProperties;

  accentPanelTone: string;
  accentInputTone: string;
  accentHintTone: string;
};

function keyForAccent(theme: Theme) {
  return theme === "dark" ? "aura_accent_dark" : "aura_accent_light";
}

export function useAppearance(): AppearanceState {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  // Always start from theme default
  const [accentHex, setAccentHex] = useState<string>(getThemeAccent(DEFAULT_THEME));
  const [accentDraft, _setAccentDraft] = useState<string>(getThemeAccent(DEFAULT_THEME));
  const [accentError, setAccentError] = useState<string | null>(null);

  const [isAccentOpen, setIsAccentOpen] = useState(false);
  const [recentAccents, setRecentAccents] = useState<string[]>([]);
  const [volume, setVolume] = useState<number>(0.85);

  const ui = useMemo(() => buildUiTokens(theme), [theme]);
  const accentPresets = useMemo(() => [...getThemeAccents(theme)], [theme]);

  const accentRgb = useMemo(() => {
    return hexToRgb(accentHex) ?? hexToRgb(getThemeAccent(theme))!;
  }, [accentHex, theme]);

  const accentRgbVar = useMemo(() => rgbToCssVar(accentRgb), [accentRgb]);

  const accentRgbRef = useRef<Rgb>(accentRgb);
  useEffect(() => {
    accentRgbRef.current = accentRgb;
  }, [accentRgb]);

  // -------------------------
  // Apply accent (preset-only)
  // -------------------------
  const applyAccent = (hex: string) => {
    const v = normalizeHex(hex);

    if (!isValidHex6(v)) {
      setAccentError("Invalid HEX");
      return false;
    }
    if (!isAllowedAccent(v, theme)) {
      setAccentError("Not allowed for this theme");
      return false;
    }

    setAccentError(null);
    setAccentHex(v);
    _setAccentDraft(v);

    // Persist custom selection per theme
    if (typeof window !== "undefined") {
      localStorage.setItem(keyForAccent(theme), v);
    }

    setRecentAccents((prev) => [v, ...prev.filter((p) => normalizeHex(p) !== v)].slice(0, 10));
    return true;
  };

  // -------------------------
  // Initial load (HARD DEFAULT ACCENT)
  // - Load theme from storage
  // - BUT force accent to theme-default (your request)
  // -------------------------
  useEffect(() => {
    const savedTheme =
      typeof window !== "undefined" ? (localStorage.getItem("aura_theme") as Theme | null) : null;

    const nextTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : DEFAULT_THEME;
    setTheme(nextTheme);

    // FORCE THEME DEFAULT ACCENT ON BOOT
    const forced = getThemeAccent(nextTheme);
    setAccentHex(forced);
    _setAccentDraft(forced);
    setAccentError(null);

    const savedVol = typeof window !== "undefined" ? localStorage.getItem("aura_volume") : null;
    if (savedVol) {
      const n = Number(savedVol);
      if (!Number.isNaN(n)) setVolume(Math.min(1, Math.max(0, n)));
    }

    const savedRecent =
      typeof window !== "undefined" ? localStorage.getItem("aura_accent_recent") : null;
    if (savedRecent) {
      try {
        const arr = JSON.parse(savedRecent) as string[];
        if (Array.isArray(arr) && arr.length) {
          const cleaned = arr
            .map(normalizeHex)
            .filter(isValidHex6)
            .filter((x, i, a) => a.indexOf(x) === i)
            .slice(0, 10);
          setRecentAccents(cleaned);
        }
      } catch {}
    }
  }, []);

  // Persist theme + volume + recent
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("aura_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("aura_volume", String(volume));
  }, [volume]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("aura_accent_recent", JSON.stringify(recentAccents.slice(0, 10)));
  }, [recentAccents]);

  // -------------------------
  // Theme toggle (HARD DEFAULT ACCENT)
  // - always go to theme default immediately
  // -------------------------
  const toggleTheme = () => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";

      const forced = getThemeAccent(next);
      setAccentHex(forced);
      _setAccentDraft(forced);
      setAccentError(null);

      return next;
    });
  };

  // Enforce allowed accent; if current accent is not in theme set, go default
  useEffect(() => {
    if (!isAllowedAccent(accentHex, theme)) {
      const forced = getThemeAccent(theme);
      setAccentHex(forced);
      _setAccentDraft(forced);
      setAccentError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Draft typing (UI uses presets anyway)
  const setAccentDraft = (v: string) => {
    const nv = normalizeHex(v);
    _setAccentDraft(nv);

    if (!isValidHex6(nv)) {
      setAccentError("Invalid HEX");
      return;
    }
    if (!isAllowedAccent(nv, theme)) {
      setAccentError("Not allowed for this theme");
      return;
    }
    setAccentError(null);
  };

  const accentStyle = useMemo(() => {
    return {
      "--accent": accentHex,
      "--accent-rgb": accentRgbVar,
    } as CSSProperties;
  }, [accentHex, accentRgbVar]);

  const accentPanelTone =
    theme === "dark"
      ? "bg-[#0a0a0a] border border-white/10 shadow-2xl"
      : "bg-white border border-black/10 shadow-2xl";

  const accentInputTone =
    theme === "dark"
      ? "bg-black/40 border border-white/10 text-slate-100 placeholder:text-slate-600"
      : "bg-black/5 border border-black/10 text-black placeholder:text-black/40";

  const accentHintTone = theme === "dark" ? "text-slate-500" : "text-black/50";

  return {
    theme,
    toggleTheme,
    ui,

    accentHex,
    accentDraft,
    setAccentDraft,

    accentError,
    setAccentError,

    isAccentOpen,
    setIsAccentOpen,

    recentAccents,
    accentPresets,
    applyAccent,

    volume,
    setVolume,

    accentRgb,
    accentRgbRef,

    accentStyle,

    accentPanelTone,
    accentInputTone,
    accentHintTone,
  };
}