import path from "path";

/**
 * Returns the pipeline-scoped subdirectory inside the user's output root.
 * e.g. pipelineOutputDir("./output", "insights") -> "./output/insights"
 */
export function pipelineOutputDir(outputDir: string, pipelineId: string): string {
  return path.join(outputDir, pipelineId);
}

/** Absolute path to a file under the pipeline's asset folder. */
export function pipelineAssetPath(pipelineId: string, relativePath: string): string {
  return path.join(process.cwd(), "src/lib/pipelines", pipelineId, "assets", relativePath);
}
