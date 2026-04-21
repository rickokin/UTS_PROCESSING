import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolvePipeline, type RouteContext } from "@/lib/pipelines/route-helpers";
import { pipelineOutputDir } from "@/lib/pipelines/paths";

async function readMomentsFromDir(dir: string): Promise<any[]> {
  const files = await fs.readdir(dir);
  const momentFiles = files.filter(f => f.endsWith("_moments_tagged.json"));

  let allMoments: any[] = [];
  for (const file of momentFiles) {
    const filePath = path.join(dir, file);
    const content = await fs.readFile(filePath, "utf-8");
    try {
      const moments = JSON.parse(content);
      if (Array.isArray(moments)) {
        allMoments = allMoments.concat(moments);
      }
    } catch {
      console.error(`Failed to parse ${filePath}`);
    }
  }
  return allMoments;
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

    try {
      await fs.access(outputDir);
    } catch {
      return NextResponse.json({ error: "Output directory does not exist" }, { status: 400 });
    }

    const pipelineDir = pipelineOutputDir(outputDir, pipelineId);

    let moments: any[] = [];
    try {
      await fs.access(pipelineDir);
      moments = await readMomentsFromDir(pipelineDir);
    } catch {
      // Pipeline subdirectory doesn't exist yet.
    }

    // Legacy fallback: if the pipeline subdir is empty but flat-layout moments
    // exist at the root, read from there. This keeps pre-migration output dirs
    // working with the insights pipeline.
    if (moments.length === 0 && pipelineId === "insights") {
      try {
        const legacyMoments = await readMomentsFromDir(outputDir);
        if (legacyMoments.length > 0) {
          console.warn(
            `[read-moments] No moments found in ${pipelineDir}; falling back to legacy flat layout at ${outputDir}. Consider moving *_moments_tagged.json files into the pipeline subdirectory.`
          );
          moments = legacyMoments;
        }
      } catch {}
    }

    return NextResponse.json({ moments });
  } catch (error: any) {
    console.error("Error reading moments:", error);
    return NextResponse.json({ error: error.message || "Error reading moments" }, { status: 500 });
  }
}
