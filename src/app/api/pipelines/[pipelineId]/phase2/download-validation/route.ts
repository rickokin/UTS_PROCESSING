import { generateValidationPDF } from "@/lib/pdfGenerator";
import fs from "fs";
import path from "path";
import os from "os";
import { resolvePipeline, type RouteContext } from "@/lib/pipelines/route-helpers";

export async function POST(req: Request, ctx: RouteContext) {
  const resolved = await resolvePipeline(ctx);
  if (resolved instanceof Response) return resolved;
  const { pipelineId } = resolved;

  try {
    const { validation } = await req.json();
    if (!validation) {
      return new Response(JSON.stringify({ error: "No validation data provided" }), { status: 400 });
    }

    const tmpPath = path.join(os.tmpdir(), `${pipelineId}_validation_report_${Date.now()}.pdf`);
    await generateValidationPDF(validation, tmpPath);

    const buffer = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    return new Response(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pipelineId}_validation_report.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Download Validation Report Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
