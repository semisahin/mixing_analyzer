"use client";

import { useState } from "react";

import type { Theme, UiTokens, Rgb, UploadHistoryItem } from "../lib/types";
import type { RefObject, Dispatch, SetStateAction } from "react";

import { useTargetProfile } from "../features/targets/useTargetProfile";
import { getToleranceLU } from "../lib/targets";

import HeaderBar from "../components/dashboard/HeaderBar";
import WaveformCard from "../components/dashboard/WaveformCard";
import FeedbackReport from "../components/dashboard/FeedbackReport";
import UploadHistoryCard from "../components/dashboard/UploadHistoryCard";
import RightPanel from "../components/dashboard/RightPanel";
import LoudnessTimelineCard from "../components/dashboard/LoudnessTimelineCard";
import HelpDrawer from "../components/help/HelpDrawer";

type LoudnessPoint = { t: number; st: number; m: number };

type Props = {
  stage: "dashboard";

  stereoWidth: number;
  correlation: number;

  // Phase 1 verdict-safe (stable aggregates)
  truePeakDbVerdict: number;
  correlationVerdict: number;

  theme: Theme;
  ui: UiTokens;

  readLoudnessTimelineSnapshot: () => LoudnessPoint[];
  onSeekSeconds: (tSec: number) => void;

  headerZ: string;
  accentPanelZ: string;

  isPlaying: boolean;
  togglePlayback: () => void;

  volume: number;
  setVolume: (v: number) => void;

  liveLufs: number;
  averageLufs: number;

  toggleTheme: () => void;

  onUploadFile?: (file: File) => void;

  isAccentOpen: boolean;
  setIsAccentOpen: Dispatch<SetStateAction<boolean>>;

  accentRgb: Rgb;

  fileInfo: { name: string; size: string };

  accentHex: string;
  accentDraft: string;
  setAccentDraft: (v: string) => void;
  accentError: string | null;
  setAccentError: (v: string | null) => void;

  applyAccent: (hex: string) => boolean;

  accentPresets: string[];
  recentAccents: string[];

  accentPanelTone: string;
  accentInputTone: string;
  accentHintTone: string;

  url: string | null;
  time: { current: number; total: number };

  waveWrapRef: RefObject<HTMLDivElement | null>;
  cWave: RefObject<HTMLCanvasElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  cGonio: RefObject<HTMLCanvasElement | null>;

  seekFromClientX: (clientX: number) => void;

  onAudioEnded: () => void;
  onAudioPause: () => void;
  onAudioPlay: () => void;

  uploadHistory: UploadHistoryItem[];

  rmsDb: number;
  truePeakDb: number;
};

export default function DashboardStage(props: Props) {
  const [isHowToOpen, setIsHowToOpen] = useState(false);

  const {
    profileId,
    setProfileId,
    customLUFS,
    setCustomLUFS,
    targetLUFS,
    targetLUFSRef,
  } = useTargetProfile({ profileId: "spotify", customLUFS: -14 });

  const toleranceLU = getToleranceLU(profileId);

  const {
    theme,
    ui,
    readLoudnessTimelineSnapshot,
    onSeekSeconds,
    headerZ,
    accentPanelZ,
    isPlaying,
    togglePlayback,
    volume,
    setVolume,
    liveLufs,
    averageLufs,
    toggleTheme,
    onUploadFile,
    isAccentOpen,
    setIsAccentOpen,
    accentRgb,
    fileInfo,
    accentHex,
    accentDraft,
    setAccentDraft,
    accentError,
    setAccentError,
    applyAccent,
    accentPresets,
    recentAccents,
    accentPanelTone,
    accentInputTone,
    accentHintTone,
    url,
    time,
    waveWrapRef,
    cWave,
    audioRef,
    cGonio,
    seekFromClientX,
    onAudioEnded,
    onAudioPause,
    onAudioPlay,
    uploadHistory,
    rmsDb,
    truePeakDb,
    stereoWidth,
    correlation,

    // Phase 1 verdict-safe
    truePeakDbVerdict,
    correlationVerdict,
  } = props;

  return (
    <div className="w-full max-w-[1200px] flex flex-col gap-6 lg:gap-8 animate-in slide-in-from-bottom duration-700">
      <HeaderBar
        theme={theme}
        ui={ui}
        isPlaying={isPlaying}
        togglePlayback={togglePlayback}
        volume={volume}
        setVolume={setVolume}
        liveLufs={liveLufs}
        averageLufs={averageLufs}
        targetLUFS={targetLUFS}
        toleranceLU={toleranceLU}
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
        headerZ={headerZ}
        accentPanelZ={accentPanelZ}
        onOpenHelp={() => setIsHowToOpen(true)}
      />

      <HelpDrawer open={isHowToOpen} onClose={() => setIsHowToOpen(false)} theme={theme} ui={ui} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6 lg:gap-8 min-w-0">
          <WaveformCard
            ui={ui}
            theme={theme}
            accentHex={accentHex}
            url={url}
            time={time}
            waveWrapRef={waveWrapRef}
            cWave={cWave}
            audioRef={audioRef}
            seekFromClientX={seekFromClientX}
            onEnded={onAudioEnded}
            onPause={onAudioPause}
            onPlay={onAudioPlay}
          />

          <LoudnessTimelineCard
            theme={theme}
            ui={ui}
            accentRgb={accentRgb}
            getSnapshot={readLoudnessTimelineSnapshot}
            getPlayheadTime={() => audioRef.current?.currentTime ?? 0}
            totalSeconds={time.total}
            onSeekSeconds={onSeekSeconds}
            targetLUFSRef={targetLUFSRef}
            targetLUFS={targetLUFS}
            toleranceLU={toleranceLU}
          />

          {/* Phase 1: Verdict uses stable aggregates (no flapping) */}
          <FeedbackReport
            theme={theme}
            ui={ui}
            accentRgb={accentRgb}
            targetLUFS={targetLUFS}
            toleranceLU={toleranceLU}
            averageLufs={averageLufs}
            truePeakDb={truePeakDbVerdict}
            correlation={correlationVerdict}
          />

          <UploadHistoryCard theme={theme} ui={ui} uploadHistory={uploadHistory} />
        </div>

        <div className="lg:col-span-4 min-w-0 self-start">
          {/* Keep meters live in the right panel */}
          <RightPanel
            stereoWidth={stereoWidth}
            correlation={correlation}
            theme={theme}
            ui={ui}
            rmsDb={rmsDb}
            truePeakDb={truePeakDb}
            cGonio={cGonio}
            targetProfileId={profileId}
            onChangeTargetProfileId={setProfileId}
            customTargetLUFS={customLUFS}
            onChangeCustomTargetLUFS={setCustomLUFS}
            resolvedTargetLUFS={targetLUFS}
          />
        </div>
      </div>
    </div>
  );
}