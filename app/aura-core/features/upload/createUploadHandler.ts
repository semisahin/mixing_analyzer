import type { UploadHistoryItem } from "../../lib/types";

type FormatDuration = (seconds: number) => string;

type CreateUploadHandlerArgs = {
  cleanupDSP: () => Promise<void>;
  resetMeters: () => void;

  setIsPlaying: (v: boolean) => void;
  setProgress: (v: number) => void;
  setTimeTotal: (v: number) => void;
  setTimeCurrent: (v: number) => void;

  setStage: (s: "upload" | "loading" | "dashboard") => void;

  setFileInfo: (v: { name: string; size: string }) => void;

  url: string | null;
  setUrl: (v: string | null) => void;

  // waveform hooks
  invalidateWaveCache: () => void;
  setWavePcm: (url: string, l: Float32Array, r?: Float32Array) => void;
  drawWave: (l: Float32Array, r?: Float32Array) => void;

  // history
  pushHistory: (item: UploadHistoryItem) => void;
  formatDuration: FormatDuration;
};

export function createUploadHandler(args: CreateUploadHandlerArgs) {
  return async function handleUpload(file: File) {
    await args.cleanupDSP();

    args.resetMeters();
    args.setIsPlaying(false);
    args.setProgress(0);
    args.setTimeCurrent(0);
    args.setTimeTotal(0);
    args.setStage("loading");

    args.setFileInfo({
      name: file.name.toUpperCase(),
      size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
    });

    for (let i = 0; i <= 100; i += 5) {
      args.setProgress(i);
      await new Promise((r) => setTimeout(r, 22));
    }

    if (args.url) URL.revokeObjectURL(args.url);

    const createdUrl = URL.createObjectURL(file);
    args.setUrl(createdUrl);
    args.invalidateWaveCache();

    const decodeCtx = new AudioContext();
    try {
      const buf = await decodeCtx.decodeAudioData(await file.arrayBuffer());
      args.setTimeTotal(buf.duration);

      const dataL = buf.getChannelData(0);
      const dataR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : undefined;

      args.setWavePcm(createdUrl, dataL, dataR);
      args.drawWave(dataL, dataR);

      args.pushHistory({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        duration: args.formatDuration(buf.duration),
        uploadedAt: new Date().toLocaleTimeString(),
      });

      args.setStage("dashboard");
    } finally {
      try {
        await decodeCtx.close();
      } catch {}
    }
  };
}