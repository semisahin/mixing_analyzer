import type { TargetProfile, TargetProfileId } from "./types";

export const TARGET_PROFILES: TargetProfile[] = [
  { id: "spotify", label: "Spotify", targetLUFS: -14, toleranceLU: 1 },
  { id: "apple_music", label: "Apple Music", targetLUFS: -16, toleranceLU: 1 },
  { id: "club_master", label: "Club Master", targetLUFS: -8, toleranceLU: 1 },
  { id: "film_dialogue", label: "Film / Dialogue", targetLUFS: -24, toleranceLU: 2 },
  { id: "custom", label: "Custom", targetLUFS: null, toleranceLU: 1 },
];

export function resolveTargetLUFS(profileId: TargetProfileId, customLUFS: number): number {
  const p = TARGET_PROFILES.find(x => x.id === profileId);
  if (!p) return -14;
  return p.targetLUFS ?? customLUFS;
}

export function getToleranceLU(profileId: TargetProfileId): number {
  const p = TARGET_PROFILES.find(x => x.id === profileId);
  return p?.toleranceLU ?? 1;
}