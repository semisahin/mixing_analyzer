"use client";

import type { UiTokens } from "../lib/types";

type Props = {
  stage: "loading";
  ui: UiTokens;
  progress: number;
};

export default function LoadingStage({ ui, progress }: Props) {
  return (
    <div className="flex-grow flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-[420px] h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
        <div className={`h-full ${ui.accentBg} ${ui.accentGlowLine}`} style={{ width: `${progress}%` }} />
      </div>
      <p className={`mt-8 font-mono text-sm tracking-[0.5em] animate-pulse ${ui.accentText}`}>
        {progress}% ANALYZING...
      </p>
    </div>
  );
}