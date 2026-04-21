import { generatePDF } from "@/lib/pdfGenerator";
import fs from "fs";
import path from "path";
import os from "os";
import { resolvePipeline, type RouteContext } from "@/lib/pipelines/route-helpers";

export async function POST(req: Request, ctx: RouteContext) {
  const resolved = await resolvePipeline(ctx);
  if (resolved instanceof Response) return resolved;
  const { pipelineId } = resolved;

  try {
    const { report } = await req.json();
    if (!report) {
      return new Response(JSON.stringify({ error: "No report provided" }), { status: 400 });
    }

    const tmpPath = path.join(os.tmpdir(), `${pipelineId}_report_${Date.now()}.pdf`);
    await generatePDF(report, tmpPath);

    const buffer = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    return new Response(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pipelineId}_report.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Download Report Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
