"use client";

import { useState } from "react";
import type { UploadHistoryItem } from "../../lib/types";

export function useUploadHistory() {
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);

  function push(item: UploadHistoryItem) {
    setUploadHistory((prev) => [item, ...prev]);
  }

  function clear() {
    setUploadHistory([]);
  }

  return { uploadHistory, push, clear };
}