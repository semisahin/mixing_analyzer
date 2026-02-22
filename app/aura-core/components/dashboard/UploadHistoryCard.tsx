"use client";

import type { Theme, UiTokens, UploadHistoryItem } from "../../lib/types";

type Props = {
  theme: Theme;
  ui: UiTokens;
  uploadHistory: UploadHistoryItem[];
};

export default function UploadHistoryCard({ theme, ui, uploadHistory }: Props) {
  return (
    <div className={`${ui.cardC} rounded-[3rem] p-6 sm:p-8 shadow-xl`}>
      <h3 className={`text-sm font-black uppercase tracking-[0.35em] mb-6 ${ui.accentText}`}>Upload History</h3>
      <div className="space-y-3 max-h-56 overflow-auto pr-1">
        {uploadHistory.length === 0 ? (
          <p className={`${ui.subtleText} text-sm`}>No uploads yet.</p>
        ) : (
          uploadHistory.map((item, idx) => (
            <div
              key={`${item.name}-${item.uploadedAt}-${idx}`}
              className={`${
                theme === "dark" ? "bg-black/40 border border-white/5" : "bg-black/5 border border-black/10"
              } rounded-2xl p-4 flex items-center justify-between`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-wide truncate">{item.name}</p>
                <p className={`text-xs mt-1 ${ui.subtleText}`}>{item.uploadedAt}</p>
              </div>
              <div className={`text-right text-xs font-mono ${ui.softText} shrink-0`}>
                <p>{item.size}</p>
                <p>{item.duration}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}