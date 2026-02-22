"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Stage, LufsSample } from "./aura-core/lib/types";

import UploadStage from "./aura-core/stage/UploadStage";
import LoadingStage from "./aura-core/stage/LoadingStage";
import DashboardStage from "./aura-core/stage/Dashboard";

import { useAppearance } from "./aura-core/features/appearance/useAppearance";
import { useUploadHistory } from "./aura-core/features/history/useUploadHistory";
import { createUploadHandler } from "./aura-core/features/upload/createUploadHandler";

import { useWaveformCache } from "./aura-core/features/render/useWaveformCache";
import { drawWaveform } from "./aura-core/features/render/waveformRenderer";
import { drawGoniometer } from "./aura-core/features/render/gonioRenderer";

// Help Drawer (render at root to avoid transform/fixed issues)
import HelpDrawer from "./aura-core/components/help/HelpDrawer";

export default function AuraFinalFixed() {
  const [stage, setStage] = useState<Stage>("upload");
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState({ name: "", size: "" });
  const [time, setTime] = useState({ current: 0, total: 0 });

  const [liveLufs, setLiveLufs] = useState<number>(-70);
  const [averageLufs, setAverageLufs] = useState<number>(-70);
  const [rmsDb, setRmsDb] = useState<number>(-70);
  const [truePeakDb, setTruePeakDb] = useState<number>(-70);

  const [shortTermLufs, setShortTermLufs] = useState<number>(-70);
  const [momentaryLufs, setMomentaryLufs] = useState<number>(-70);
  const [dynamicRange, setDynamicRange] = useState<number>(0);

  // Stereo Imager meters
  const [stereoWidth, setStereoWidth] = useState<number>(0);
  const [correlation, setCorrelation] = useState<number>(0);
  const stereoUiLastMsRef = useRef(0);
  const stereoUiHz = 15;

  // Help Drawer state at root
  const [helpOpen, setHelpOpen] = useState(false);

  // =============================
  // FEATURES
  // =============================
  const {
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

    accentRgb,
    accentRgbRef,

    recentAccents,
    accentPresets,
    applyAccent,

    volume,
    setVolume,

    accentStyle,

    accentPanelTone,
    accentInputTone,
    accentHintTone,
  } = useAppearance();

  const { uploadHistory, push: pushHistory } = useUploadHistory();
  const waveCache = useWaveformCache();

  // =============================
  // REFS
  // =============================
  const audioRef = useRef<HTMLAudioElement>(null);
  const cWave = useRef<HTMLCanvasElement>(null);
  const cGonio = useRef<HTMLCanvasElement>(null);
  const waveWrapRef = useRef<HTMLDivElement>(null);

  // DSP refs
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const outGainRef = useRef<GainNode | null>(null); // volume only for output
  const rafRef = useRef<number | null>(null);
  const nodes = useRef<{ lNode?: AnalyserNode; rNode?: AnalyserNode }>({});

  // Prealloc analyzer buffers
  const dLRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(1024));
  const dRRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(1024));

  // short-term/momentary buffers
  const lufsBufferRef = useRef<LufsSample[]>([]);
  const lufsStatsRef = useRef({ sum: 0, samples: 0 });

  // allow repaint when paused
  const lastGonioRef = useRef<{ l: Float32Array; r: Float32Array } | null>(null);

  // ===== Phase 1: Stable verdict aggregates (monotonic) =====
  const truePeakMaxDbRef = useRef<number>(-70); // max true peak so far
  const corrMinRef = useRef<number>(1); // min correlation so far (worst mono compatibility)

  // avoid stale closure in RAF for theme
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // =============================
  // VOLUME APPLY (GainNode only)
  // =============================
  useEffect(() => {
    const ctx = ctxRef.current;
    const g = outGainRef.current;
    if (!ctx || !g) return;
    g.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }, [volume]);

  // close accent panel on stage change
  useEffect(() => {
    setIsAccentOpen(false);
  }, [stage, setIsAccentOpen]);

  // =============================
  // DSP CLEANUP
  // =============================
  const cleanupDSP = async () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    try {
      nodes.current.lNode?.disconnect();
    } catch {}
    try {
      nodes.current.rNode?.disconnect();
    } catch {}
    nodes.current = {};

    try {
      splitterRef.current?.disconnect();
    } catch {}
    splitterRef.current = null;

    try {
      outGainRef.current?.disconnect();
    } catch {}
    outGainRef.current = null;

    try {
      sourceRef.current?.disconnect();
    } catch {}
    sourceRef.current = null;

    if (ctxRef.current) {
      try {
        await ctxRef.current.close();
      } catch {}
      ctxRef.current = null;
    }
  };

  // unmount cleanup
  useEffect(() => {
    return () => {
      void cleanupDSP();
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================
  // LOUDNESS TIMELINE (refs only)
  // =============================
  const timelineHz = 20;
  const timelineMaxSeconds = 600;
  const timelineCapacity = timelineHz * timelineMaxSeconds;

  const tlTRef = useRef<Float32Array>(new Float32Array(timelineCapacity));
  const tlSTRef = useRef<Float32Array>(new Float32Array(timelineCapacity));
  const tlMRef = useRef<Float32Array>(new Float32Array(timelineCapacity));
  const tlWriteIdxRef = useRef(0);
  const tlSizeRef = useRef(0);
  const tlLastSampleMsRef = useRef(0);

  const readLoudnessTimelineSnapshot = useMemo(() => {
    return () => {
      const n = tlSizeRef.current;
      const out = new Array<{ t: number; st: number; m: number }>(n);
      const start = (tlWriteIdxRef.current - n + timelineCapacity) % timelineCapacity;
      for (let i = 0; i < n; i++) {
        const idx = (start + i) % timelineCapacity;
        out[i] = {
          t: tlTRef.current[idx],
          st: tlSTRef.current[idx],
          m: tlMRef.current[idx],
        };
      }
      return out;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================
  // WAVEFORM REPAINT (NO RE-DECODE)
  // =============================
  useEffect(() => {
    if (stage !== "dashboard" || !url || !audioRef.current) return;
    if (!cWave.current) return;

    const audioEl = audioRef.current;
    if (audioEl.src !== url) audioEl.src = url;

    const cached = waveCache.getCached(url);
    if (cached) {
      drawWaveform(cWave.current, themeRef.current, accentRgbRef.current, cached.l, cached.r);
      return;
    }

    (async () => {
      try {
        const decoded = await waveCache.decodeUrl(url);
        if (!cWave.current) return;
        drawWaveform(cWave.current, themeRef.current, accentRgbRef.current, decoded.l, decoded.r);
      } catch {}
    })();
  }, [stage, url, theme, accentHex, waveCache, accentRgbRef]);

  // repaint gonio when paused + theme/accent changes
  useEffect(() => {
    const audioEl = audioRef.current;
    const c = cGonio.current;
    const last = lastGonioRef.current;
    if (!audioEl || !c || !last) return;
    if (!audioEl.paused) return;

    drawGoniometer(c, themeRef.current, accentRgbRef.current, last.l, last.r);
  }, [theme, accentHex, accentRgbRef]);

  // =============================
  // METERS
  // =============================
  const resetMeters = () => {
    setLiveLufs(-70);
    setAverageLufs(-70);
    setRmsDb(-70);
    setTruePeakDb(-70);
    setShortTermLufs(-70);
    setMomentaryLufs(-70);
    setDynamicRange(0);

    setStereoWidth(0);
    setCorrelation(0);
    stereoUiLastMsRef.current = 0;

    lufsStatsRef.current = { sum: 0, samples: 0 };
    lufsBufferRef.current = [];

    tlWriteIdxRef.current = 0;
    tlSizeRef.current = 0;
    tlLastSampleMsRef.current = 0;

    // Phase 1: reset stable verdict aggregates
    truePeakMaxDbRef.current = -70;
    corrMinRef.current = 1;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // =============================
  // UPLOAD HANDLER (FEATURE)
  // =============================
  const handleUpload = useMemo(() => {
    return createUploadHandler({
      cleanupDSP,
      resetMeters,

      setIsPlaying,
      setProgress,

      setTimeTotal: (v) => setTime((prev) => ({ ...prev, total: v })),
      setTimeCurrent: (v) => setTime((prev) => ({ ...prev, current: v })),

      setStage,

      setFileInfo,

      url,
      setUrl,

      invalidateWaveCache: waveCache.invalidate,
      setWavePcm: waveCache.setPcm,
      drawWave: (l, r) => {
        if (!cWave.current) return;
        drawWaveform(cWave.current, themeRef.current, accentRgbRef.current, l, r);
      },

      pushHistory,
      formatDuration,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, pushHistory, waveCache]);

  // =============================
  // DASHBOARD HEADER UPLOAD (FIX)
  // =============================
  const onUploadFile = (file: File) => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
      } catch {}
      try {
        a.currentTime = 0;
      } catch {}
      try {
        a.removeAttribute("src");
        a.load();
      } catch {}
    }
    setIsPlaying(false);

    const h: any = handleUpload as any;
    if (typeof h === "function") {
      h(file);
      return;
    }
    if (h && typeof h.handleFile === "function") {
      h.handleFile(file);
      return;
    }
    if (h && typeof h.uploadFile === "function") {
      h.uploadFile(file);
      return;
    }

    console.warn("[AuraCore] Upload handler is not callable. Check createUploadHandler return type.");
  };

  // =============================
  // DSP INIT + LOOP
  // =============================
  const initDSP = () => {
    if (ctxRef.current || !audioRef.current) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audioRef.current);

    // IMPORTANT: keep element volume unity (do NOT tie analysis to UI volume)
    audioRef.current.volume = 1;

    const lNode = ctx.createAnalyser();
    const rNode = ctx.createAnalyser();
    lNode.fftSize = 2048;
    rNode.fftSize = 2048;

    // PRE-FADER ANALYSIS
    const splitter = ctx.createChannelSplitter(2);
    source.connect(splitter);
    splitter.connect(lNode, 0);
    splitter.connect(rNode, 1);

    // POST-FADER OUTPUT
    const outGain = ctx.createGain();
    outGain.gain.value = volume;

    source.connect(outGain);
    outGain.connect(ctx.destination);

    // store refs
    nodes.current = { lNode, rNode };
    ctxRef.current = ctx;
    sourceRef.current = source;
    splitterRef.current = splitter;
    outGainRef.current = outGain;

    drawLoop();
  };

  const drawLoop = () => {
    const lNode = nodes.current.lNode;
    const rNode = nodes.current.rNode;
    const a = audioRef.current;
    if (!lNode || !rNode || !a) return;

    const dL = dLRef.current;
    const dR = dRRef.current;

    lNode.getFloatTimeDomainData(dL);
    rNode.getFloatTimeDomainData(dR);

    let sqSum = 0;
    for (let i = 0; i < dL.length; i++) sqSum += dL[i] * dL[i];

    const rms = Math.sqrt(sqSum / dL.length) || 0.000001;
    const currentLUFS = Math.max(-70, 20 * Math.log10(rms) - 0.691);

    let peakLinear = 0.000001;
    for (let i = 0; i < dL.length; i++) {
      const aL = Math.abs(dL[i]);
      const aR = Math.abs(dR[i]);
      if (aL > peakLinear) peakLinear = aL;
      if (aR > peakLinear) peakLinear = aR;
    }

    const rmsDbValue = Math.max(-70, 20 * Math.log10(rms));
    const truePeakDbValue = Math.max(-70, 20 * Math.log10(peakLinear));

    // Phase 1: stable aggregate (max true peak so far)
    if (truePeakDbValue > truePeakMaxDbRef.current) {
      truePeakMaxDbRef.current = truePeakDbValue;
    }

    if (!a.paused) {
      let sumM2 = 0;
      let sumS2 = 0;
      let sumLR = 0;
      let sumL2 = 0;
      let sumR2 = 0;

      for (let i = 0; i < dL.length; i++) {
        const l = dL[i];
        const r = dR[i];

        const m = 0.5 * (l + r);
        const s = 0.5 * (l - r);

        sumM2 += m * m;
        sumS2 += s * s;

        sumLR += l * r;
        sumL2 += l * l;
        sumR2 += r * r;
      }

      const denomMS = sumM2 + sumS2;
      let width01 = denomMS > 1e-12 ? sumS2 / denomMS : 0;

      const denomCorr = Math.sqrt(sumL2 * sumR2);
      let corr = denomCorr > 1e-12 ? sumLR / denomCorr : 0;

      if (!Number.isFinite(width01)) width01 = 0;
      if (!Number.isFinite(corr)) corr = 0;

      width01 = Math.min(1, Math.max(0, width01));
      corr = Math.min(1, Math.max(-1, corr));

      // Phase 1: stable aggregate (min correlation so far)
      if (corr < corrMinRef.current) {
        corrMinRef.current = corr;
      }

      const nowStereo = performance.now();
      const stereoInterval = 1000 / stereoUiHz;
      if (nowStereo - stereoUiLastMsRef.current >= stereoInterval) {
        stereoUiLastMsRef.current = nowStereo;
        setStereoWidth(width01);
        setCorrelation(corr);
      }

      setLiveLufs(currentLUFS);
      setRmsDb(rmsDbValue);
      setTruePeakDb(truePeakDbValue);

      const now = performance.now();
      lufsBufferRef.current.push({ t: now, v: currentLUFS });

      const cutoffShort = now - 3000;
      while (lufsBufferRef.current.length && lufsBufferRef.current[0].t < cutoffShort) {
        lufsBufferRef.current.shift();
      }

      const buf = lufsBufferRef.current;
      const shortAvg = buf.length > 0 ? buf.reduce((acc, s) => acc + s.v, 0) / buf.length : currentLUFS;
      setShortTermLufs(shortAvg);

      const cutoffMom = now - 400;
      let momSum = 0;
      let momCount = 0;
      for (let i = buf.length - 1; i >= 0; i--) {
        if (buf[i].t < cutoffMom) break;
        momSum += buf[i].v;
        momCount++;
      }
      const momAvg = momCount > 0 ? momSum / momCount : shortAvg;
      setMomentaryLufs(momAvg);

      setDynamicRange(truePeakDbValue - rmsDbValue);

      lufsStatsRef.current.sum += currentLUFS;
      lufsStatsRef.current.samples += 1;
      setAverageLufs(lufsStatsRef.current.sum / lufsStatsRef.current.samples);

      const intervalMs = 1000 / timelineHz;
      if (now - tlLastSampleMsRef.current >= intervalMs) {
        tlLastSampleMsRef.current = now;

        const tSec = a.currentTime || 0;
        const i = tlWriteIdxRef.current;

        tlTRef.current[i] = tSec;
        tlSTRef.current[i] = shortAvg;
        tlMRef.current[i] = momAvg;

        tlWriteIdxRef.current = (i + 1) % timelineCapacity;
        tlSizeRef.current = Math.min(timelineCapacity, tlSizeRef.current + 1);
      }
    }

    setTime((prev) => ({ ...prev, current: a.currentTime || 0 }));

    // Note: this allocates (slice) but matches your current behavior.
    lastGonioRef.current = { l: dL.slice(), r: dR.slice() };

    if (cGonio.current) {
      drawGoniometer(cGonio.current, themeRef.current, accentRgbRef.current, dL, dR);
    }

    rafRef.current = requestAnimationFrame(drawLoop);
  };

  // =============================
  // PLAYBACK
  // =============================
  const togglePlayback = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
      return;
    }

    initDSP();

    if (ctxRef.current?.state === "suspended") {
      try {
        await ctxRef.current.resume();
      } catch {}
    }

    // IMPORTANT: Do NOT set a.volume = volume here.
    // Keep audio element at unity; output volume is handled by outGainRef.
    a.volume = 1;

    await a.play();
    setIsPlaying(true);
  };

  // =============================
  // SEEK
  // =============================
  const seekFromClientX = (clientX: number) => {
    const a = audioRef.current;
    const w = waveWrapRef.current;
    if (!a || !w || !time.total) return;
    const rect = w.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = ratio * time.total;
    setTime((prev) => ({ ...prev, current: a.currentTime || 0 }));
  };

  const headerZ = "relative z-50";
  const accentPanelZ = "z-[999]";

  return (
    <main
      style={accentStyle}
      className={`min-h-screen flex flex-col items-center font-sans ${ui.appBg}
      px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10`}
    >
      {/* Root-mounted drawer: ALWAYS visible above all transforms */}
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} theme={theme} ui={ui} />

      {stage === "upload" && (
        <UploadStage
          stage="upload"
          theme={theme}
          ui={ui}
          toggleTheme={toggleTheme}
          onUpload={handleUpload}
          accentHex={accentHex}
        />
      )}

      {stage === "loading" && <LoadingStage stage="loading" ui={ui} progress={progress} />}

      {stage === "dashboard" && (
        <DashboardStage
          stage="dashboard"
          theme={theme}
          ui={ui}
          headerZ={headerZ}
          accentPanelZ={accentPanelZ}
          isPlaying={isPlaying}
          togglePlayback={togglePlayback}
          volume={volume}
          setVolume={setVolume}
          liveLufs={liveLufs}
          averageLufs={averageLufs}
          toggleTheme={toggleTheme}
          onUploadFile={onUploadFile}
          isAccentOpen={isAccentOpen}
          setIsAccentOpen={setIsAccentOpen}
          accentRgb={accentRgb}
          fileInfo={fileInfo}
          accentHex={accentHex}
          accentDraft={accentDraft}
          setAccentDraft={setAccentDraft}
          accentError={accentError}
          setAccentError={setAccentError}
          applyAccent={applyAccent}
          accentPresets={accentPresets}
          recentAccents={recentAccents}
          accentPanelTone={accentPanelTone}
          accentInputTone={accentInputTone}
          accentHintTone={accentHintTone}
          url={url}
          time={time}
          waveWrapRef={waveWrapRef}
          cWave={cWave}
          audioRef={audioRef}
          seekFromClientX={seekFromClientX}
          onAudioEnded={() => setIsPlaying(false)}
          onAudioPause={() => setIsPlaying(false)}
          onAudioPlay={() => setIsPlaying(true)}
          uploadHistory={uploadHistory}
          rmsDb={rmsDb}
          truePeakDb={truePeakDb}
          // Phase 1 verdict-safe values:
          truePeakDbVerdict={truePeakMaxDbRef.current}
          cGonio={cGonio}
          readLoudnessTimelineSnapshot={readLoudnessTimelineSnapshot}
          onSeekSeconds={(tSec) => {
            const a = audioRef.current;
            if (!a || !time.total) return;
            a.currentTime = Math.max(0, Math.min(time.total, tSec));
            setTime((prev) => ({ ...prev, current: a.currentTime || 0 }));
          }}
          stereoWidth={stereoWidth}
          correlation={correlation}
          // Phase 1 verdict-safe values:
          correlationVerdict={corrMinRef.current}
        />
      )}
    </main>
  );
}