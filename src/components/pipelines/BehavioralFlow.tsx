"use client";

import { useState } from "react";
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import type { PipelineDefinition } from "@/lib/pipelines/types";

interface BehavioralFlowProps {
  pipeline: PipelineDefinition;
  outputDir: string;
  uploadDir: string;
}

export default function BehavioralFlow({ pipeline, outputDir, uploadDir }: BehavioralFlowProps) {
  const [probeState, setProbeState] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "confirmed"; status: number; message: string }
    | { state: "error"; message: string }
  >({ state: "idle" });

  const probeWiring = async () => {
    setProbeState({ state: "checking" });
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}/phase1/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "", episodeId: "placeholder" }),
      });
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setProbeState({
        state: "confirmed",
        status: res.status,
        message: body.error || body.message || `HTTP ${res.status}`,
      });
    } catch (err: any) {
      setProbeState({ state: "error", message: err?.message || "Unknown error" });
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-amber-900">
              Placeholder pipeline — not yet implemented
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              The <strong>{pipeline.label}</strong> pipeline is registered so it shows up in the
              tab bar alongside other extraction types, but its schemas, prompts, and handlers have
              not been authored yet. All API endpoints for this pipeline currently respond with
              HTTP 501 (Not Implemented).
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow border border-gray-200">
        <h3 className="text-base font-semibold mb-2">Planned steps</h3>
        <p className="text-sm text-gray-500 mb-4">
          When this pipeline is wired up, the following steps will become runnable from this tab.
        </p>
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          {pipeline.steps.map((step) => (
            <li key={step.id}>
              <span className="font-medium">{step.label}</span>
              <span className="ml-2 inline-block text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {step.kind}
              </span>
              {step.description && <span className="block ml-6 text-xs text-gray-500 mt-0.5">{step.description}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl bg-white p-6 shadow border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Configuration in scope</h3>
            <p className="text-sm text-gray-500 mt-1">
              Transcripts: <code>{uploadDir}</code>. Outputs will land in <code>{outputDir}/{pipeline.id}/</code>.
            </p>
          </div>
          <button
            disabled
            title="Placeholder pipeline — not yet implemented"
            className="bg-gray-200 text-gray-500 px-5 py-2.5 rounded-lg font-semibold text-sm cursor-not-allowed flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Run Pipeline
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow border border-gray-200">
        <h3 className="text-base font-semibold mb-2">Wiring check (debug)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Confirms the API route for this pipeline is reachable and correctly returns 501 Not Implemented.
        </p>
        <button
          onClick={probeWiring}
          disabled={probeState.state === "checking"}
          className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {probeState.state === "checking" && <Loader2 className="w-4 h-4 animate-spin" />}
          Ping {pipeline.id} route
        </button>
        {probeState.state === "confirmed" && (
          <p className="mt-3 text-xs text-gray-700">
            Response: <code className="bg-gray-100 px-1.5 py-0.5 rounded">HTTP {probeState.status}</code>
            <span className="text-gray-500 ml-2">{probeState.message}</span>
          </p>
        )}
        {probeState.state === "error" && (
          <p className="mt-3 text-xs text-red-600">Error: {probeState.message}</p>
        )}
      </section>
    </div>
  );
}
