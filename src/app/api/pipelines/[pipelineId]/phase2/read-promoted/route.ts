import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolvePipeline, type RouteContext } from "@/lib/pipelines/route-helpers";
import { pipelineOutputDir } from "@/lib/pipelines/paths";

async function tryReadJson(filePath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  const resolved = await resolvePipeline(ctx);
  if (resolved instanceof Response) return resolved;
  const { pipelineId } = resolved;

  try {
    const { outputDir } = await req.json();
    if (!outputDir) {
      return NextResponse.json({ error: "Missing outputDir" }, { status: 400 });
    }

    const pipelinePath = path.join(pipelineOutputDir(outputDir, pipelineId), "promoted_clusters.json");
    let insights = await tryReadJson(pipelinePath);

    if (!insights && pipelineId === "insights") {
      // Legacy flat-layout fallback
      const legacyPath = path.join(outputDir, "promoted_clusters.json");
      const legacy = await tryReadJson(legacyPath);
      if (legacy) {
        console.warn(
          `[read-promoted] Using legacy file ${legacyPath}; move it to ${pipelinePath} to adopt the per-pipeline layout.`
        );
        insights = legacy;
      }
    }

    if (!insights) {
      return NextResponse.json({ error: "promoted_clusters.json does not exist in output directory" }, { status: 404 });
    }

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error("Error reading promoted clusters:", error);
    return NextResponse.json({ error: error.message || "Error reading promoted clusters" }, { status: 500 });
  }
}
