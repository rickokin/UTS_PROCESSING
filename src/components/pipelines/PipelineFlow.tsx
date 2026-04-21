"use client";

import { useSharedConfig } from "@/lib/hooks/useSharedConfig";
import type { PipelineDefinition } from "@/lib/pipelines/types";
import InsightsFlow from "./InsightsFlow";
import BehavioralFlow from "./BehavioralFlow";
import { Loader2 } from "lucide-react";

/**
 * Client-side dispatcher that reads the shared config from localStorage and
 * renders the appropriate *Flow component for the chosen pipeline.
 */
export default function PipelineFlow({ pipeline }: { pipeline: PipelineDefinition }) {
  const { outputDir, uploadDir, hydrated } = useSharedConfig();

  if (!hydrated) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading configuration...
      </div>
    );
  }

  if (pipeline.id === "insights") {
    return <InsightsFlow pipelineId={pipeline.id} outputDir={outputDir} uploadDir={uploadDir} />;
  }

  if (pipeline.id === "behavioral") {
    return <BehavioralFlow pipeline={pipeline} outputDir={outputDir} uploadDir={uploadDir} />;
  }

  return (
    <div className="rounded-xl border border-gray-200 p-6 bg-white text-sm text-gray-600">
      No UI component is registered for pipeline <code>{pipeline.id}</code> yet.
    </div>
  );
}
