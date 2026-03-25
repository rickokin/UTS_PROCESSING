import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText } from '@/lib/assets/loader';
import { callGeminiWithRetry, cleanGeminiSchema } from '@/lib/gemini';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import fs from 'fs';
import path from 'path';
import { generatePDF } from '@/lib/pdfGenerator';

export async function POST(req: Request) {
  try {
    const { insights } = await req.json();
    if (!insights || !Array.isArray(insights)) return new Response(JSON.stringify({ error: 'No insights provided' }), { status: 400 });

    // Calculate actual distinct episodes and moments from the insights payload
    const distinctEpisodes = new Set<string>();
    const distinctMoments = new Set<string>();

    insights.forEach((insight: any) => {
      // Gather episodes from derived_from_episodes strings
      if (Array.isArray(insight.derived_from_episodes)) {
        insight.derived_from_episodes.forEach((ep: string) => {
          if (typeof ep === 'string') {
            // Normalize to prevent double counting "file" and "file.docx"
            distinctEpisodes.add(ep.replace(/\.docx$/i, ''));
          }
        });
      }

      // Gather moments from supporting_moments array
      if (Array.isArray(insight.supporting_moments)) {
        insight.supporting_moments.forEach((m: any) => {
          if (m.episode_id) {
            distinctEpisodes.add(m.episode_id.replace(/\.docx$/i, ''));
          }
          if (m.moment_id) {
            // Since moment_ids like "M001" can be reused across different episodes, 
            // we combine them to get the true count of distinct moments promoted.
            const ep = m.episode_id ? m.episode_id.replace(/\.docx$/i, '') : 'unknown';
            distinctMoments.add(`${ep}-${m.moment_id}`);
          }
        });
      }
    });

    const actualEpisodesCount = distinctEpisodes.size;
    const actualMomentsCount = distinctMoments.size;

    const prompts = await loadPrompts();
    const schemas = await loadSchemas();
    const vocab = await loadAllVocabText();
    const rules = await loadAllRulesText();

    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.assembleReport}

VOCABULARIES & ENUMS:
${vocab}

RULES:
${rules}

Assemble the final Insight Report based on the Insight Objects provided. 
Produce an object that includes the report metadata as well as a full structured presentation of the report content (executive summary, key insights with verbatim quotes, and methodology).

CRITICAL: Do NOT generate or extract new quotes. You MUST strictly use the exact quotes provided in the 'representative_quotes' array of the input Insight Objects. Map them directly to the 'quotes' output array without altering a single word. You MUST verify that the 'episode_id' and 'speaker_role' match exactly what was provided.
`.trim();

    // Extend the report schema to include frontend-required fields
    const extendedReportSchema = {
      ...schemas.report,
      properties: {
        ...schemas.report.properties,
        title: { type: "string" },
        subtitle: { type: "string" },
        executive_summary: {
          type: "array",
          items: { type: "string" }
        },
        key_insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              insight_statement: { type: "string" },
              quotes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    quote: { type: "string" },
                    speaker_role: { type: "string" },
                    episode_id: { type: "string" }
                  },
                  required: ["quote", "speaker_role", "episode_id"]
                }
              }
            },
            required: ["insight_statement", "quotes"]
          }
        },
        methodology: {
          type: "object",
          properties: {
            episodes_analyzed: { type: "number" },
            moments_segmented: { type: "number" },
            confidence_threshold: { type: "string" }
          },
          required: ["episodes_analyzed", "moments_segmented", "confidence_threshold"]
        }
      },
      required: [
        ...schemas.report.required,
        "title",
        "subtitle",
        "executive_summary",
        "key_insights",
        "methodology"
      ]
    };

    const responseFormatSchema = cleanGeminiSchema({
      type: "object",
      properties: {
        report: extendedReportSchema
      },
      required: ["report"],
      additionalProperties: false
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')); } catch (e) {}
        }, 15000);

        try {
          const completionText = await callGeminiWithRetry({
            model: 'gemini-2.5-pro',
            contents: `Here are the promoted Insights:\n\n${JSON.stringify(insights, null, 2)}`,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: responseFormatSchema as any,
              temperature: 0,
            }
          });

          const result = JSON.parse(completionText || '{"report":{}}');
          
          // Override hallucinated methodology stats with actual counts
          if (result.report && result.report.methodology) {
            result.report.methodology.episodes_analyzed = actualEpisodesCount;
            result.report.methodology.moments_segmented = actualMomentsCount;
          }
          
          // Generate Word Document
          const report = result.report;
          if (report) {
            const doc = new Document({
              sections: [{
                properties: {},
                children: [
                  new Paragraph({
                    text: report.title || "Insights Report",
                    heading: HeadingLevel.TITLE,
                  }),
                  new Paragraph({
                    text: report.subtitle || "",
                    heading: HeadingLevel.HEADING_1,
                  }),
                  new Paragraph({
                    text: "Executive Summary",
                    heading: HeadingLevel.HEADING_2,
                  }),
                  ...(report.executive_summary || []).map((summaryItem: string) => 
                    new Paragraph({ text: summaryItem })
                  ),
                  new Paragraph({
                    text: "Key Insights",
                    heading: HeadingLevel.HEADING_2,
                  }),
                  ...(report.key_insights || []).flatMap((insight: any) => [
                    new Paragraph({
                      text: insight.insight_statement,
                      heading: HeadingLevel.HEADING_3,
                    }),
                    ...(insight.quotes || []).map((quoteObj: any) => 
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `"${quoteObj.quote}"`,
                            italics: true,
                          }),
                          new TextRun({
                            text: ` - ${quoteObj.speaker_role} (Episode: ${quoteObj.episode_id})`,
                          }),
                        ],
                      })
                    )
                  ]),
                  new Paragraph({
                    text: "Methodology",
                    heading: HeadingLevel.HEADING_2,
                  }),
                  new Paragraph({ text: `Episodes Analyzed: ${report.methodology?.episodes_analyzed || 0}` }),
                  new Paragraph({ text: `Moments Segmented: ${report.methodology?.moments_segmented || 0}` }),
                  new Paragraph({ text: `Confidence Threshold: ${report.methodology?.confidence_threshold || ""}` }),
                ],
              }],
            });

            const buffer = await Packer.toBuffer(doc);
            const reportsDir = path.join(process.cwd(), 'reports');
            if (!fs.existsSync(reportsDir)) {
              fs.mkdirSync(reportsDir, { recursive: true });
            }
            
            const safeTitle = (report.title || 'Insights_Report').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const docxFilePath = path.join(reportsDir, `${safeTitle}_${timestamp}.docx`);
            const pdfFilePath = path.join(reportsDir, `${safeTitle}_${timestamp}.pdf`);
            
            fs.writeFileSync(docxFilePath, buffer);
            
            // Generate PDF
            await generatePDF(report, pdfFilePath);
          }

          clearInterval(heartbeat);
          controller.enqueue(encoder.encode(JSON.stringify(result)));
          controller.close();
        } catch (error: any) {
          console.error('Assemble Error:', error);
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
    console.error('Assemble Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
