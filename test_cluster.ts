import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText } from './src/lib/pipelines/insights/loader';
import { callGeminiWithRetry, cleanGeminiSchema } from './src/lib/gemini';
import fs from 'fs/promises';

async function main() {
  const content = await fs.readFile('./output/uts_s4_podcast_001_moments_tagged.json', 'utf-8');
  let moments = JSON.parse(content);
  moments = moments.filter((m: any) => m.insight_eligible).slice(0, 100);
  
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

  console.log('Sending request to Gemini with', moments.length, 'moments...');
  const completionText = await callGeminiWithRetry({
    model: 'gemini-2.5-pro',
    contents: `Here are the tagged moments to cluster:\n\n${JSON.stringify(moments, null, 2)}`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: responseFormatSchema as any,
      temperature: 0,
    }
  });

  console.log('Response text:', completionText);
}

main().catch(console.error);
