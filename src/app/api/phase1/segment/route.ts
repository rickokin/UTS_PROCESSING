import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText, loadPdfRules } from '@/lib/assets/loader';
import { callGeminiWithRetry, cleanGeminiSchema } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { text, episodeId } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: 'No text provided' }), { status: 400 });

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
    
    // Chunk the text to avoid output token limits
    // 10,000 chars is roughly 2,000-2,500 tokens
    const CHUNK_SIZE = 10000;
    const chunks: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      let nextIndex = currentIndex + CHUNK_SIZE;
      
      // If we're not at the end, try to find a newline to split on so we don't cut paragraphs in half
      if (nextIndex < text.length) {
        const lastNewline = text.lastIndexOf('\n', nextIndex);
        // If we found a newline in the last 5000 chars of this chunk, split there instead
        if (lastNewline > currentIndex + CHUNK_SIZE - 5000) {
          nextIndex = lastNewline + 1; // include the newline
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
            // Send progress update
            const progress = Math.round((i / chunks.length) * 100);
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', progress }) + '\n'));

            const chunk = chunks[i];
            
            // Start a heartbeat to prevent browser/proxy connection timeouts
            const heartbeatInterval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'heartbeat' }) + '\n'));
              } catch(e) {}
            }, 15000);

            let completionText;
            try {
              completionText = await callGeminiWithRetry({
                model: 'gemini-2.5-pro',
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

          // Send 100% progress and the complete result
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', progress: 100 }) + '\n'));
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'complete', moments: allMoments }) + '\n'));
          controller.close();
        } catch (error: any) {
          if (req.signal.aborted || error.message?.includes('Controller is already closed') || error.code === 'ERR_INVALID_STATE') {
            return;
          }
          console.error('Segment Error Stream:', error);
          try {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: error.message }) + '\n'));
            controller.close();
          } catch (e) {
            // ignore
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      status: 200,
    });
  } catch (error: any) {
    console.error('Segment Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
