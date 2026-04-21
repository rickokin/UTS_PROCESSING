import type { PipelineDefinition } from "../types";

export const insightsPipeline: PipelineDefinition = {
  id: "insights",
  label: "Insights Report",
  shortDescription:
    "Segments transcripts into tagged moments, clusters and promotes them into insights, optionally validates against external research, and assembles a structured report.",
  status: "active",
  capabilities: {
    usesDemographics: true,
    usesExternalResearch: true,
    producesReport: true,
  },
  steps: [
    {
      id: "segment",
      label: "Segment transcripts into tagged moments",
      kind: "per-file",
      artifact: "<episode>_moments_tagged.json",
      description: "Per-file pass that extracts insight-eligible moments and tags them against the Locks Pack vocabularies.",
    },
    {
      id: "cluster",
      label: "Cluster moments",
      kind: "aggregate",
      artifact: "clusters.json",
      requires: ["segment"],
    },
    {
      id: "promote",
      label: "Promote clusters to insights",
      kind: "aggregate",
      artifact: "promoted_clusters.json",
      requires: ["cluster"],
    },
    {
      id: "validate",
      label: "Validate insights against external research",
      kind: "aggregate",
      artifact: "validation.json",
      requires: ["promote"],
      optional: true,
    },
    {
      id: "assemble",
      label: "Assemble final report",
      kind: "report",
      artifact: "report.json",
      requires: ["promote"],
    },
  ],
};
