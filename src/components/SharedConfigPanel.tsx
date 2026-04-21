"use client";

import { useRef, useState } from "react";
import { CheckCircle, FileSearch, Loader2, UploadCloud } from "lucide-react";
import { useSharedConfig } from "@/lib/hooks/useSharedConfig";

type UploadStatus<T extends Record<string, any>> =
  | { state: "idle" }
  | { state: "uploading" }
  | ({ state: "done" } & T)
  | { state: "error"; message: string };

/**
 * Global config: transcript directory, JSON output directory, and the two
 * shared upload slots (demographics CSV + external research document).
 * Shown on the pipeline-selector landing page so the values apply to every
 * pipeline tab.
 */
export default function SharedConfigPanel() {
  const { outputDir, uploadDir, setOutputDir, setUploadDir } = useSharedConfig();

  const [demographicsStatus, setDemographicsStatus] =
    useState<UploadStatus<{ filename: string; rowCount: number }>>({ state: "idle" });
  const [researchStatus, setResearchStatus] =
    useState<UploadStatus<{ filename: string; charCount: number }>>({ state: "idle" });

  const demographicsInputRef = useRef<HTMLInputElement>(null);
  const researchInputRef = useRef<HTMLInputElement>(null);

  const handleDemographicsUpload = async (file: File) => {
    setDemographicsStatus({ state: "uploading" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("outputDir", outputDir);

      const res = await fetch("/api/upload-demographics", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setDemographicsStatus({ state: "done", filename: file.name, rowCount: data.rowCount });
    } catch (err: any) {
      setDemographicsStatus({ state: "error", message: err.message });
    }
  };

  const handleResearchUpload = async (file: File) => {
    setResearchStatus({ state: "uploading" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("outputDir", outputDir);

      const res = await fetch("/api/upload-research", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setResearchStatus({ state: "done", filename: file.name, charCount: data.charCount });
    } catch (err: any) {
      setResearchStatus({ state: "error", message: err.message });
    }
  };

  return (
    <section className="p-6 bg-white rounded-xl shadow border border-gray-200">
      <h2 className="text-xl font-bold mb-4">Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium text-gray-700">Transcript Directory</label>
          <input
            type="text"
            value={uploadDir}
            onChange={(e) => setUploadDir(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm text-gray-900"
            placeholder="./uploads"
          />
          <p className="text-xs text-gray-500">
            The directory where your .docx transcripts are located. Shared across every pipeline.
          </p>
        </div>
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium text-gray-700">JSON Output Directory</label>
          <input
            type="text"
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm text-gray-900"
            placeholder="./output"
          />
          <p className="text-xs text-gray-500">
            Each pipeline writes artifacts to a subdirectory under this path (e.g. <code>{outputDir}/insights/</code>).
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium text-gray-700">Participant Demographics (CSV)</label>
        <div className="mt-2 flex items-center gap-4">
          <input
            ref={demographicsInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDemographicsUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => demographicsInputRef.current?.click()}
            disabled={demographicsStatus.state === "uploading"}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {demographicsStatus.state === "uploading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4" />
            )}
            {demographicsStatus.state === "uploading" ? "Uploading..." : "Upload CSV"}
          </button>
          {demographicsStatus.state === "done" && (
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              {demographicsStatus.filename} — {demographicsStatus.rowCount} participants saved to {outputDir}/demographics.json
            </span>
          )}
          {demographicsStatus.state === "error" && (
            <span className="text-sm text-red-600">{demographicsStatus.message}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Optional: Upload a CSV with participant demographics to enrich reports with diversity context. Shared across pipelines.
        </p>
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium text-gray-700">External Research Document (PDF, DOCX, or TXT)</label>
        <div className="mt-2 flex items-center gap-4">
          <input
            ref={researchInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleResearchUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => researchInputRef.current?.click()}
            disabled={researchStatus.state === "uploading"}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {researchStatus.state === "uploading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSearch className="w-4 h-4" />
            )}
            {researchStatus.state === "uploading" ? "Processing..." : "Upload Research Document"}
          </button>
          {researchStatus.state === "done" && (
            <span className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              {researchStatus.filename} — {researchStatus.charCount.toLocaleString()} characters extracted
            </span>
          )}
          {researchStatus.state === "error" && (
            <span className="text-sm text-red-600">{researchStatus.message}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Optional: Upload external research to validate extracted insights against published findings. Shared across pipelines.
        </p>
      </div>
    </section>
  );
}
