"use client";

import { useRef } from "react";

export function useWaveformCache() {
  const lastWaveUrlRef = useRef<string | null>(null);
  const waveDataRef = useRef<{ l: Float32Array; r?: Float32Array } | null>(null);

  function invalidate() {
    lastWaveUrlRef.current = null;
    waveDataRef.current = null;
  }

  function setPcm(url: string, l: Float32Array, r?: Float32Array) {
    lastWaveUrlRef.current = url;
    waveDataRef.current = { l, r };
  }

  function getCached(url: string) {
    if (lastWaveUrlRef.current !== url) return null;
    return waveDataRef.current;
  }

  async function decodeUrl(url: string) {
    const decodeCtx = new AudioContext();
    try {
      const fileBuffer = await fetch(url).then((r) => r.arrayBuffer());
      const buf = await decodeCtx.decodeAudioData(fileBuffer);
      const l = buf.getChannelData(0);
      const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : undefined;
      setPcm(url, l, r);
      return { l, r, duration: buf.duration };
    } finally {
      try {
        await decodeCtx.close();
      } catch {}
    }
  }

  return { invalidate, setPcm, getCached, decodeUrl };
}