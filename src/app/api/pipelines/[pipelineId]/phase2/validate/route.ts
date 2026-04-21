import { callGeminiWithRetry, cleanGeminiSchema } from "@/lib/gemini";
import { generateValidationPDF } from "@/lib/pdfGenerator";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from "docx";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { loadExternalResearch } from "@/lib/shared/loader";
import { resolvePipeline, notImplementedResponse, ensurePipelineOutputDir, type RouteContext } from "@/lib/pipelines/route-helpers";
import { loadPrompts, loadSchemas, loadAllVocabText, loadValidationRulesText } from "@/lib/pipelines/insights/loader";

export async function POST(req: Request, ctx: RouteContext) {
  const resolved = await resolvePipeline(ctx);
  if (resolved instanceof Response) return resolved;
  const { pipelineId } = resolved;

  if (pipelineId !== "insights") {
    return notImplementedResponse(pipelineId, "validate");
  }

  try {
    const { insights, outputDir } = await req.json();
    if (!insights || !Array.isArray(insights)) {
      return new Response(JSON.stringify({ error: "No insights provided" }), { status: 400 });
    }
    if (!outputDir) {
      return new Response(JSON.stringify({ error: "No outputDir provided" }), { status: 400 });
    }

    // External research is a shared resource (uploaded once per outputDir), so
    // we look for it at the root rather than under the pipeline subdirectory.
    const externalResearch = await loadExternalResearch(outputDir);
    if (!externalResearch) {
      return new Response(
        JSON.stringify({ error: "No external research document found. Please upload a research document first." }),
        { status: 400 }
      );
    }

    const prompts = await loadPrompts();
    const schemas = await loadSchemas();
    const vocab = await loadAllVocabText();
    const validationRulesText = await loadValidationRulesText();

    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.validateInsights}

VOCABULARIES & ENUMS:
${vocab}

VALIDATION RULES:
${validationRulesText}

EXTERNAL RESEARCH DOCUMENT (source: "${externalResearch.filename}"):
--- BEGIN EXTERNAL TEXT ---
${externalResearch.extracted_text}
--- END EXTERNAL TEXT ---

Validate each promoted Insight Object against the external research document above.
Produce a structured validation assessment matching validation.schema.v1.json.
Return valid JSON only.
`.trim();

    const responseFormatSchema = cleanGeminiSchema({
      type: "object",
      properties: {
        validation: schemas.validation
      },
      required: ["validation"],
      additionalProperties: false
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(" ")); } catch {}
        }, 15000);

        try {
          const completionText = await callGeminiWithRetry({
            model: "gemini-2.5-pro",
            contents: `Here are the promoted Insights to validate:\n\n${JSON.stringify(insights, null, 2)}`,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: responseFormatSchema as any,
              temperature: 0,
            }
          });

          const result = JSON.parse(completionText || '{"validation":{}}');

          const pipelineDir = await ensurePipelineOutputDir(outputDir, pipelineId);
          const validationPath = path.join(pipelineDir, "validation.json");
          await fs.writeFile(validationPath, JSON.stringify(result.validation, null, 2), "utf-8");

          // Save validation PDF + DOCX to the shared reports directory, prefixed with pipeline id.
          try {
            const reportsDir = path.join(process.cwd(), "reports");
            if (!fsSync.existsSync(reportsDir)) {
              fsSync.mkdirSync(reportsDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const pdfFilePath = path.join(reportsDir, `${pipelineId}_validation_report_${timestamp}.pdf`);
            await generateValidationPDF(result.validation, pdfFilePath);

            const docxDoc = buildValidationDocx(result.validation);
            const docxBuffer = await Packer.toBuffer(docxDoc);
            const docxFilePath = path.join(reportsDir, `${pipelineId}_validation_report_${timestamp}.docx`);
            fsSync.writeFileSync(docxFilePath, docxBuffer);
          } catch (reportErr: any) {
            console.warn("Failed to save validation report files:", reportErr.message);
          }

          clearInterval(heartbeat);
          controller.enqueue(encoder.encode(JSON.stringify(result)));
          controller.close();
        } catch (error: any) {
          console.error("Validation Error:", error);
          clearInterval(heartbeat);
          controller.enqueue(encoder.encode(JSON.stringify({ error: error.message })));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      status: 200
    });
  } catch (error: any) {
    console.error("Validation Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

function buildValidationDocx(validation: any): Document {
  const statusLabel = (s: string) =>
    ({ supported: "Supported", partially_supported: "Partially Supported", not_supported: "Not Supported", not_addressed: "Not Addressed" }[s] || s);

  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const logoBuffer = fsSync.readFileSync(logoPath);

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 120, height: 120 },
          type: "png",
        }),
      ],
    }),
    new Paragraph({ text: "External Research Validation Report", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: "Overall Alignment Summary", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: validation.overall_alignment_summary || "" }),
  ];

  if (validation.external_source_summary) {
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({ text: "External Source", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: validation.external_source_summary }),
    );
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({ text: "Insight-by-Insight Validation", heading: HeadingLevel.HEADING_2 }),
  );

  for (const iv of validation.insight_validations || []) {
    children.push(
      new Paragraph({ text: iv.insight_title, heading: HeadingLevel.HEADING_3 }),
      new Paragraph({
        children: [
          new TextRun({ text: "Status: ", bold: true }),
          new TextRun({ text: statusLabel(iv.validation_status) }),
        ],
      }),
      new Paragraph({ text: iv.external_evidence_summary }),
    );
    if (iv.alignment_notes) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "Alignment: ", bold: true }),
          new TextRun({ text: iv.alignment_notes }),
        ],
      }));
    }
    for (const excerpt of iv.relevant_external_excerpts || []) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `"${excerpt}"`, italics: true })],
      }));
    }
  }

  if (validation.insights_not_in_external?.length > 0) {
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Insights Not Found in External Research", heading: HeadingLevel.HEADING_2 }),
    );
    for (const gap of validation.insights_not_in_external) {
      children.push(
        new Paragraph({ text: gap.insight_title, heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: gap.gap_note }),
      );
    }
  }

  if (validation.external_findings_not_in_extracted?.length > 0) {
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Novel Findings from External Research", heading: HeadingLevel.HEADING_2 }),
    );
    for (const f of validation.external_findings_not_in_extracted) {
      children.push(
        new Paragraph({ text: f.finding_title, heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: f.finding_summary }),
        new Paragraph({
          children: [
            new TextRun({ text: "Relevance: ", bold: true }),
            new TextRun({ text: f.relevance_to_study }),
          ],
        }),
      );
    }
  }

  return new Document({ sections: [{ properties: {}, children }] });
}
