import type { PipelineDefinition } from "../types";

/**
 * Placeholder definition for the behavioral-patterns pipeline. The shape of
 * this pipeline (steps, artifacts, capabilities) is still being finalized;
 * once the requirements are locked this file and its assets directory will
 * be filled in. Until then the pipeline appears in the UI but all step
 * handlers respond with HTTP 501.
 */
export const behavioralPipeline: PipelineDefinition = {
  id: "behavioral",
  label: "Behavioral Patterns",
  shortDescription:
    "Extracts behavioral patterns from transcripts and runs downstream analysis. Placeholder — implementation coming soon.",
  status: "placeholder",
  capabilities: {
    usesDemographics: false,
    usesExternalResearch: false,
    producesReport: false,
  },
  steps: [
    {
      id: "extract_patterns",
      label: "Extract behavioral patterns",
      kind: "per-file",
      artifact: "<episode>_behavioral_patterns.json",
      description: "Placeholder step. Will extract recurring behavioral patterns from each transcript.",
    },
  ],
};
