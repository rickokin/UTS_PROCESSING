import { callGeminiWithRetry, cleanGeminiSchema } from "@/lib/gemini";
import { resolvePipeline, notImplementedResponse, type RouteContext } from "@/lib/pipelines/route-helpers";
import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText } from "@/lib/pipelines/insights/loader";

export async function POST(req: Request, ctx: RouteContext) {
  const resolved = await resolvePipeline(ctx);
  if (resolved instanceof Response) return resolved;
  const { pipelineId } = resolved;

  if (pipelineId !== "insights") {
    return notImplementedResponse(pipelineId, "promote");
  }

  try {
    const { clusters, moments } = await req.json();
    if (!clusters || !Array.isArray(clusters)) return new Response(JSON.stringify({ error: "No clusters provided" }), { status: 400 });

    const prompts = await loadPrompts();
    const schemas = await loadSchemas();
    const vocab = await loadAllVocabText();
    const rules = await loadAllRulesText();

    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.promoteClusters}

VOCABULARIES & ENUMS:
${vocab}

RULES:
${rules}

Promote the provided clusters into Insight Objects. Follow promotion gates strictly. Assign confidence levels. Ensure every insight matches the schema.

CRITICAL: The system should determine the best exact quotes to use to support the key insights. It is OK to use up to 2 quotes if they support the insight, but at least one must be selected.
You MUST ONLY use exact, verbatim text directly extracted from the provided 'moment_text' fields in the 'member_moments_data' array.
Do NOT invent, hallucinate, alter, or paraphrase quotes under any circumstances. You must literally copy and paste the text exactly as it appears in the 'moment_text'.
The "quote_usage" value MUST exactly match a substring of the speaker's original 'moment_text', and the "episode_id" MUST correctly correspond to the episode where the quote was spoken.
Do NOT invent facts. NEVER synthesize a representative quote that sounds good but isn't actually in the provided text.
`.trim();

    const responseFormatSchema = cleanGeminiSchema({
      type: "object",
      properties: {
        insights: {
          type: "array",
          items: schemas.insight
        }
      },
      required: ["insights"],
      additionalProperties: false
    });

    // Index moments so Gemini can receive the full source text for every cluster member.
    const momentMap = new Map();
    if (moments && Array.isArray(moments)) {
      moments.forEach(m => {
        momentMap.set(m.moment_id, m);
        if (m.episode_id) {
          momentMap.set(`${m.episode_id}/${m.moment_id}`, m);
          const cleanEpisodeId = m.episode_id.replace(/\.docx$/i, "");
          momentMap.set(`${cleanEpisodeId}/${m.moment_id}`, m);
        }
      });
    }

    const enrichedClusters = clusters.map(cluster => {
      const enrichedMoments = (cluster.member_moment_ids || []).map((id: string) => {
        let m = momentMap.get(id);
        if (!m && id.includes("/")) {
          const parts = id.split("/");
          m = momentMap.get(parts[parts.length - 1]);
        }

        return m ? {
          moment_id: m.moment_id,
          episode_id: m.episode_id,
          speaker_role: m.speaker_role,
          moment_text: m.moment_text
        } : { moment_id: id };
      });
      return {
        ...cluster,
        member_moments_data: enrichedMoments
      };
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(" ")); } catch {}
        }, 15000);

        try {
          const CHUNK_SIZE = 15;
          let allInsights: any[] = [];

          for (let i = 0; i < enrichedClusters.length; i += CHUNK_SIZE) {
            const chunk = enrichedClusters.slice(i, i + CHUNK_SIZE);
            console.log(`[Promote API] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} with ${chunk.length} clusters...`);

            const completionText = await callGeminiWithRetry({
              model: "gemini-2.5-pro",
              contents: `Here are the clusters to promote, along with the source text for their member moments:\n\n${JSON.stringify(chunk, null, 2)}`,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: responseFormatSchema as any,
                temperature: 0,
              }
            });

            const result = JSON.parse(completionText || '{"insights":[]}');
            if (result.insights && Array.isArray(result.insights)) {
              allInsights = allInsights.concat(result.insights);
              console.log(`[Promote API] Parsed ${result.insights.length} insights from chunk.`);
            }
          }

          console.log(`[Promote API] Total insights generated: ${allInsights.length}`);
          clearInterval(heartbeat);
          controller.enqueue(encoder.encode(JSON.stringify({ insights: allInsights })));
          controller.close();
        } catch (error: any) {
          console.error("Promote Error:", error);
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
    console.error("Promote Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
