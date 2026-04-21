import type { PipelineDefinition } from "./types";
import { insightsPipeline } from "./insights";
import { behavioralPipeline } from "./behavioral";

export const PIPELINES: Record<string, PipelineDefinition> = {
  [insightsPipeline.id]: insightsPipeline,
  [behavioralPipeline.id]: behavioralPipeline,
};

export const PIPELINE_IDS = Object.keys(PIPELINES);

export function getPipeline(id: string): PipelineDefinition | null {
  return PIPELINES[id] ?? null;
}

export function listPipelines(): PipelineDefinition[] {
  return Object.values(PIPELINES);
}

export function isKnownPipelineId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PIPELINES, id);
}
