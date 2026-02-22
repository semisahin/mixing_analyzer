// lib/types.ts
export type Stage = "upload" | "loading" | "dashboard";
export type Theme = "dark" | "light";

export type FeedbackModuleProps = {
  title: string;
  status: string;
  desc: string;
};

export type UploadHistoryItem = {
  name: string;
  size: string;
  duration: string;
  uploadedAt: string;
};

export type LufsSample = {
  t: number; // ms timestamp
  v: number; // LUFS value
};

export type Rgb = { r: number; g: number; b: number };

export type TargetProfileId =
  | "spotify"
  | "apple_music"
  | "club_master"
  | "film_dialogue"
  | "custom";

export type TargetProfile = {
  id: TargetProfileId;
  label: string;
  targetLUFS: number | null; // null => custom uses customLUFS
  toleranceLU?: number; // UI/report only
  notes?: string;
};

export type TargetSelection = {
  profileId: TargetProfileId;
  customLUFS: number;
};

export type UiTokens = {
  appBg: string;
  cardA: string;
  cardB: string;
  cardC: string;
  cardRight: string;
  subtleText: string;
  softText: string;
  waveCursor: string;

  accentText: string;
  accentBg: string;
  accentBgSoft: string;
  accentBgSofter: string;
  accentBorder: string;
  accentBorderStrong: string;
  accentGlow: string;
  accentGlowSoft: string;
  accentGlowLine: string;
};