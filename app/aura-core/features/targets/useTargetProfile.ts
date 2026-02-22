"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TargetProfileId } from "../../lib/types";
import { resolveTargetLUFS, TARGET_PROFILES } from "../../lib/targets";

export function useTargetProfile(init?: { profileId?: TargetProfileId; customLUFS?: number }) {
  const [profileId, setProfileId] = useState<TargetProfileId>(init?.profileId ?? "spotify");
  const [customLUFS, setCustomLUFS] = useState<number>(init?.customLUFS ?? -14);

  const targetLUFS = useMemo(
    () => resolveTargetLUFS(profileId, customLUFS),
    [profileId, customLUFS]
  );

  // Engine-safe bridge
  const targetLUFSRef = useRef<number>(targetLUFS);
  useEffect(() => {
    targetLUFSRef.current = targetLUFS;
  }, [targetLUFS]);

  const profile = useMemo(
    () => TARGET_PROFILES.find(p => p.id === profileId) ?? TARGET_PROFILES[0],
    [profileId]
  );

  return {
    profile,
    profileId,
    setProfileId,
    customLUFS,
    setCustomLUFS,
    targetLUFS,
    targetLUFSRef,
  };
}