import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText } from '@/lib/assets/loader';
import { callGeminiWithRetry, cleanGeminiSchema } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { moments } = await req.json();
    if (!moments || !Array.isArray(moments)) return new Response(JSON.stringify({ error: 'No moments provided' }), { status: 400 });

    const prompts = await loadPrompts();
    const schemas = await loadSchemas();
    const vocab = await loadAllVocabText();
    const rules = await loadAllRulesText();

    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.clusterMoments}

VOCABULARIES & ENUMS:
${vocab}

RULES:
${rules}

Cluster the following insight-eligible moments across episodes based on similarity drivers (primary: barrier, agency, system; secondary: life_stage, emotion).
Output an array of clusters.
`.trim();

    const responseFormatSchema = cleanGeminiSchema({
      type: "object",
      properties: {
        clusters: {
          type: "array",
          items: schemas.cluster
        }
      },
      required: ["clusters"],
      additionalProperties: false
    });

    const filteredMoments = moments
      .filter((m: any) => m.insight_eligible)
      .map((m: any) => ({
        ...m,
        moment_id: `${m.episode_id.replace(/\.docx$/i, '')}/${m.moment_id}`
      }));
    console.log(`[Cluster API] Received ${moments.length} total moments. Filtered down to ${filteredMoments.length} insight-eligible moments.`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')); } catch (e) {}
        }, 15000);

        try {
          const CHUNK_SIZE = 150;
          let allClusters: any[] = [];

          for (let i = 0; i < filteredMoments.length; i += CHUNK_SIZE) {
            const chunk = filteredMoments.slice(i, i + CHUNK_SIZE);
            console.log(`[Cluster API] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} with ${chunk.length} moments...`);

            const completionText = await callGeminiWithRetry({
              model: 'gemini-2.5-pro',
              contents: `Here are the tagged moments to cluster:\n\n${JSON.stringify(chunk, null, 2)}`,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: responseFormatSchema as any,
                temperature: 0,
              }
            });

            const result = JSON.parse(completionText || '{"clusters":[]}');
            if (result.clusters && Array.isArray(result.clusters)) {
              allClusters = allClusters.concat(result.clusters);
              console.log(`[Cluster API] Parsed ${result.clusters.length} clusters from chunk.`);
            }
          }

          console.log(`[Cluster API] Total clusters generated: ${allClusters.length}`);
          clearInterval(heartbeat);
          controller.enqueue(encoder.encode(JSON.stringify({ clusters: allClusters })));
          controller.close();
        } catch (error: any) {
          console.error('Cluster Error:', error);
          clearInterval(heartbeat);
          controller.enqueue(encoder.encode(JSON.stringify({ error: error.message })));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      status: 200
    });
  } catch (error: any) {
    console.error('Cluster Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
