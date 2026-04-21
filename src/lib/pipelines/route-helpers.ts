import fs from "fs/promises";
import { getPipeline } from "./registry";
import { pipelineOutputDir } from "./paths";
import type { PipelineDefinition } from "./types";

export type RouteContext = {
  params: Promise<{ pipelineId: string }>;
};

export interface ResolvedPipeline {
  pipeline: PipelineDefinition;
  pipelineId: string;
}

/**
 * Extracts pipelineId from the route params, validates it against the
 * registry, and returns either a resolved pipeline or a Response to return
 * directly. Use as:
 *
 *   const resolved = await resolvePipeline(ctx);
 *   if (resolved instanceof Response) return resolved;
 */
export async function resolvePipeline(ctx: RouteContext): Promise<ResolvedPipeline | Response> {
  const { pipelineId } = await ctx.params;
  const pipeline = getPipeline(pipelineId);
  if (!pipeline) {
    return new Response(
      JSON.stringify({ error: `Unknown pipeline '${pipelineId}'` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  return { pipeline, pipelineId };
}

/**
 * Returns a 501 response for steps on a placeholder pipeline.
 */
export function notImplementedResponse(pipelineId: string, stepId: string): Response {
  return new Response(
    JSON.stringify({
      error: `The '${pipelineId}' pipeline is a placeholder; step '${stepId}' is not yet implemented.`,
      pipelineId,
      stepId,
      status: "not_implemented",
    }),
    { status: 501, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Ensure the pipeline output subdirectory exists and return its path.
 */
export async function ensurePipelineOutputDir(outputDir: string, pipelineId: string): Promise<string> {
  const dir = pipelineOutputDir(outputDir, pipelineId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
