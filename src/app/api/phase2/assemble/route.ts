import { loadPrompts, loadSchemas, loadAllVocabText, loadAllRulesText, loadDemographicsFromOutput, computeDemographicsSummary, loadValidationFromOutput } from '@/lib/assets/loader';
import { callGeminiWithRetry, cleanGeminiSchema } from '@/lib/gemini';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import fs from 'fs';
import path from 'path';
import { generatePDF } from '@/lib/pdfGenerator';

export async function POST(req: Request) {
  try {
    const { insights, outputDir } = await req.json();
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

    // Load demographics only if the user uploaded a CSV (saved as demographics.json)
    let demographicsSummary = null;
    let demographicsPromptBlock = '';
    try {
      const demoRows = outputDir ? await loadDemographicsFromOutput(outputDir) : null;
      if (demoRows && demoRows.length > 0) {
        demographicsSummary = computeDemographicsSummary(demoRows, distinctEpisodes);
        const ds = demographicsSummary;
        const ethnicGroups = ds.ethnicity_breakdown.map(e => e.group).join(', ');
        const topRegions = ds.geographic_scope.regions.slice(0, 5).map(r => `${r.region} (${r.count})`).join(', ');
        demographicsPromptBlock = `
PARTICIPANT DEMOGRAPHICS CONTEXT (computed from source data — do NOT fabricate numbers):
- Total participants represented: ${ds.total_participants}
- Age range: ${ds.age.min}–${ds.age.max} (mean ${ds.age.mean}, median ${ds.age.median})
- Ethnic backgrounds represented: ${ds.ethnicity_breakdown.length} groups (${ethnicGroups})
- Geographic scope: ${ds.geographic_scope.domestic_count} domestic (US), ${ds.geographic_scope.international_count} international
- Top regions: ${topRegions}
You may weave this diversity context into the Executive Summary narrative. The participant_demographics JSON field will be injected by the system — do NOT generate it.
`;
      }
    } catch (e) {
      console.warn('Demographics CSV not available, proceeding without:', e);
    }

    // Load validation results if they exist
    let validationPromptBlock = '';
    let validationData = null;
    try {
      validationData = outputDir ? await loadValidationFromOutput(outputDir) : null;
      if (validationData) {
        const supported = validationData.insight_validations?.filter((v: any) => v.validation_status === 'supported').length || 0;
        const partial = validationData.insight_validations?.filter((v: any) => v.validation_status === 'partially_supported').length || 0;
        const notSupported = validationData.insight_validations?.filter((v: any) => v.validation_status === 'not_supported').length || 0;
        const notAddressed = validationData.insight_validations?.filter((v: any) => v.validation_status === 'not_addressed').length || 0;
        const novelFindings = validationData.external_findings_not_in_extracted?.length || 0;

        validationPromptBlock = `
EXTERNAL RESEARCH VALIDATION CONTEXT (from validation against external research — reference this in the narrative):
- Validation completed: ${supported} insights supported, ${partial} partially supported, ${notSupported} not supported, ${notAddressed} not addressed by external research.
- ${novelFindings} novel finding(s) identified in external research not captured by transcript insights.
- Overall alignment: ${validationData.overall_alignment_summary || 'N/A'}
You may reference external corroboration in the Executive Summary or assembly notes. Note which insights are well-supported by external literature.
The external_validation_summary field in the output will capture this context for the reader.
`;
      }
    } catch (e) {
      console.warn('Validation data not available, proceeding without:', e);
    }

    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.assembleReport}

VOCABULARIES & ENUMS:
${vocab}

RULES:
${rules}
${demographicsPromptBlock}
${validationPromptBlock}
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
        },
        external_validation_summary: {
          type: "object",
          properties: {
            overview: { type: "string" },
            supported_count: { type: "number" },
            partially_supported_count: { type: "number" },
            not_supported_count: { type: "number" },
            not_addressed_count: { type: "number" },
            novel_external_findings_count: { type: "number" }
          },
          required: ["overview", "supported_count", "partially_supported_count", "not_supported_count", "not_addressed_count", "novel_external_findings_count"]
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

          // Inject deterministically computed demographics (never LLM-generated)
          if (result.report && demographicsSummary) {
            result.report.participant_demographics = demographicsSummary;
          }

          // Inject deterministically computed validation summary (never LLM-generated)
          if (result.report && validationData) {
            const supported = validationData.insight_validations?.filter((v: any) => v.validation_status === 'supported').length || 0;
            const partial = validationData.insight_validations?.filter((v: any) => v.validation_status === 'partially_supported').length || 0;
            const notSupported = validationData.insight_validations?.filter((v: any) => v.validation_status === 'not_supported').length || 0;
            const notAddressed = validationData.insight_validations?.filter((v: any) => v.validation_status === 'not_addressed').length || 0;
            const novelFindings = validationData.external_findings_not_in_extracted?.length || 0;
            result.report.external_validation_summary = {
              overview: validationData.overall_alignment_summary || '',
              supported_count: supported,
              partially_supported_count: partial,
              not_supported_count: notSupported,
              not_addressed_count: notAddressed,
              novel_external_findings_count: novelFindings,
            };
          }
          
          // Generate Word Document
          const report = result.report;
          if (report) {
            const logoPath = path.join(process.cwd(), 'public', 'logo.png');
            const logoBuffer = fs.readFileSync(logoPath);

            const doc = new Document({
              sections: [{
                properties: {},
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: { width: 120, height: 120 },
                        type: 'png',
                      }),
                    ],
                  }),
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
                  ...(report.participant_demographics ? [
                    new Paragraph({
                      text: "Participant Demographics",
                      heading: HeadingLevel.HEADING_2,
                    }),
                    new Paragraph({
                      text: `Total Participants: ${report.participant_demographics.total_participants}`,
                    }),
                    new Paragraph({
                      text: `Age Range: ${report.participant_demographics.age.min}–${report.participant_demographics.age.max} (Mean: ${report.participant_demographics.age.mean}, Median: ${report.participant_demographics.age.median})`,
                    }),
                    new Paragraph({
                      text: "Age Distribution:",
                      children: [],
                    }),
                    ...(report.participant_demographics.age_brackets || []).map((b: any) =>
                      new Paragraph({ text: `  ${b.bracket}: ${b.count} participants` })
                    ),
                    new Paragraph({
                      text: "Ethnicity:",
                      children: [],
                    }),
                    ...(report.participant_demographics.ethnicity_breakdown || []).map((e: any) =>
                      new Paragraph({ text: `  ${e.group}: ${e.count} (${e.pct}%)` })
                    ),
                    new Paragraph({
                      text: `Geographic Scope: ${report.participant_demographics.geographic_scope.domestic_count} US-based, ${report.participant_demographics.geographic_scope.international_count} international`,
                    }),
                  ] : []),
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
