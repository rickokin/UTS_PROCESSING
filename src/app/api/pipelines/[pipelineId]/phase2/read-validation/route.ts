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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
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

    const pipelineDir = pipelineOutputDir(outputDir, pipelineId);

    let validation = await tryReadJson(path.join(pipelineDir, "validation.json"));

    if (!validation && pipelineId === "insights") {
      const legacyPath = path.join(outputDir, "validation.json");
      const legacy = await tryReadJson(legacyPath);
      if (legacy) {
        console.warn(
          `[read-validation] Using legacy ${legacyPath}; move it to ${pipelineDir}/validation.json to adopt the per-pipeline layout.`
        );
        validation = legacy;
      }
    }

    // External research is a shared resource at the root of the output directory.
    const hasExternalResearch = await fileExists(path.join(outputDir, "external_research.json"));

    return NextResponse.json({ validation, hasExternalResearch });
  } catch (error: any) {
    console.error("Error reading validation status:", error);
    return NextResponse.json({ error: error.message || "Error reading validation status" }, { status: 500 });
  }
}
