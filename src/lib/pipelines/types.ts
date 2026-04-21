/**
 * Pipeline abstractions. Each extraction pipeline (insights, behavioral, etc.)
 * declares its identity, capabilities, and ordered processing steps using these
 * types. The API routes and UI both read from the pipeline registry.
 */

export type PipelineStatus = "active" | "placeholder";

/** A step is either applied per input file, aggregated across all files, or produces a report. */
export type StepKind = "per-file" | "aggregate" | "report";

export interface StepDefinition {
  id: string;
  label: string;
  kind: StepKind;
  /** Artifact written to disk after this step (filename, relative to pipeline output dir). */
  artifact?: string;
  /** Previous step ids that must have run before this step. */
  requires?: string[];
  optional?: boolean;
  description?: string;
}

export interface PipelineCapabilities {
  usesDemographics: boolean;
  usesExternalResearch: boolean;
  /** Whether the pipeline produces a final DOCX/PDF report. */
  producesReport: boolean;
}

export interface PipelineDefinition {
  id: string;
  label: string;
  shortDescription: string;
  status: PipelineStatus;
  capabilities: PipelineCapabilities;
  steps: StepDefinition[];
}
