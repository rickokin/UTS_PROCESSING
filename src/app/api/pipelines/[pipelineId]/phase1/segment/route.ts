import { callGeminiWithRetry, cleanGeminiSchema } from "@/lib/gemini";
import { loadPdfRules } from "@/lib/shared/loader";
import { resolvePipeline, notImplementedResponse, type RouteContext } from "@/lib/pipelines/route-helpers";
import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText } from "@/lib/pipelines/insights/loader";

export async function POST(req: Request, ctx: RouteContext) {
  const resolved = await resolvePipeline(ctx);
  if (resolved instanceof Response) return resolved;
  const { pipeline, pipelineId } = resolved;

  if (pipelineId !== "insights") {
    return notImplementedResponse(pipelineId, "segment");
  }
  if (pipeline.status !== "active") {
    return notImplementedResponse(pipelineId, "segment");
  }

  try {
    const { text, episodeId } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: "No text provided" }), { status: 400 });

    const prompts = await loadPrompts();
    const schemas = await loadSchemas();
    const vocab = await loadAllVocabText();
    const rules = await loadAllRulesText();
    const pdfRules = await loadPdfRules();

    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.segmentIntoMoments}

VOCABULARIES & ENUMS:
${vocab}

PDF RULES & GUIDELINES:
${pdfRules}

RULES:
${rules}

EXTRACTION & TAGGING RULES:
- Extract exact verbatim paragraphs as moments.
- episode_id: ${episodeId}
- Fill in required structural fields.
- Tag each moment with emotional_signals, agency_signals, and barrier_signals based ONLY on the vocabularies.
- Update the insight_eligible flag and eligibility_rationale based on the promotion rules.
`.trim();

    const responseFormatSchema = cleanGeminiSchema({
      type: "object",
      properties: {
        moments: {
          type: "array",
          items: schemas.moment
        }
      },
      required: ["moments"],
      additionalProperties: false
    });

    let allMoments: any[] = [];

    // Chunk the text to avoid output token limits.
    // 10,000 chars is roughly 2,000-2,500 tokens.
    const CHUNK_SIZE = 10000;
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let nextIndex = currentIndex + CHUNK_SIZE;

      if (nextIndex < text.length) {
        const lastNewline = text.lastIndexOf("\n", nextIndex);
        if (lastNewline > currentIndex + CHUNK_SIZE - 5000) {
          nextIndex = lastNewline + 1;
        }
      }

      chunks.push(text.substring(currentIndex, nextIndex));
      currentIndex = nextIndex;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < chunks.length; i++) {
            if (req.signal.aborted) return;
            const progress = Math.round((i / chunks.length) * 100);
            controller.enqueue(encoder.encode(JSON.stringify({ type: "progress", progress }) + "\n"));

            const chunk = chunks[i];

            // Heartbeat keeps the browser/proxy from timing out during long LLM calls.
            const heartbeatInterval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: "heartbeat" }) + "\n"));
              } catch {}
            }, 15000);

            let completionText;
            try {
              completionText = await callGeminiWithRetry({
                model: "gemini-2.5-pro",
                contents: `Here is part ${i + 1} of ${chunks.length} of the transcript for episode ${episodeId}:\n\n${chunk}`,
                config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: "application/json",
                  responseSchema: responseFormatSchema as any,
                  temperature: 0,
                }
              });
            } finally {
              clearInterval(heartbeatInterval);
            }

            if (req.signal.aborted) return;

            const chunkResult = JSON.parse(completionText || '{"moments":[]}');
            if (chunkResult.moments && Array.isArray(chunkResult.moments)) {
              allMoments = allMoments.concat(chunkResult.moments);
            }
          }

          if (req.signal.aborted) return;

          controller.enqueue(encoder.encode(JSON.stringify({ type: "progress", progress: 100 }) + "\n"));
          controller.enqueue(encoder.encode(JSON.stringify({ type: "complete", moments: allMoments }) + "\n"));
          controller.close();
        } catch (error: any) {
          if (req.signal.aborted || error.message?.includes("Controller is already closed") || error.code === "ERR_INVALID_STATE") {
            return;
          }
          console.error("Segment Error Stream:", error);
          try {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: error.message }) + "\n"));
            controller.close();
          } catch {}
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
      status: 200,
    });
  } catch (error: any) {
    console.error("Segment Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
