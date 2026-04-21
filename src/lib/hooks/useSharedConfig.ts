"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared configuration (transcript + output directories) that applies across
 * every pipeline. Persisted to localStorage so values survive navigation and
 * page reloads. All pipeline flows read from here; the pipeline-selector
 * landing page is the primary editor.
 */
const STORAGE_KEY = "uts_shared_config_v1";

export interface SharedConfig {
  outputDir: string;
  uploadDir: string;
}

const DEFAULT_CONFIG: SharedConfig = {
  outputDir: "./output",
  uploadDir: "./uploads",
};

function readConfig(): SharedConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SharedConfig>;
    return {
      outputDir: parsed.outputDir ?? DEFAULT_CONFIG.outputDir,
      uploadDir: parsed.uploadDir ?? DEFAULT_CONFIG.uploadDir,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function writeConfig(config: SharedConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Broadcast so other hook subscribers on the page re-sync.
    window.dispatchEvent(new CustomEvent("uts-shared-config-changed"));
  } catch {
    // Ignore quota/serialization failures silently.
  }
}

export function useSharedConfig() {
  const [config, setConfigState] = useState<SharedConfig>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfigState(readConfig());
    setHydrated(true);

    const handleChange = () => setConfigState(readConfig());
    window.addEventListener("uts-shared-config-changed", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener("uts-shared-config-changed", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const setOutputDir = useCallback((outputDir: string) => {
    setConfigState(prev => {
      const next = { ...prev, outputDir };
      writeConfig(next);
      return next;
    });
  }, []);

  const setUploadDir = useCallback((uploadDir: string) => {
    setConfigState(prev => {
      const next = { ...prev, uploadDir };
      writeConfig(next);
      return next;
    });
  }, []);

  return {
    ...config,
    hydrated,
    setOutputDir,
    setUploadDir,
  };
}
