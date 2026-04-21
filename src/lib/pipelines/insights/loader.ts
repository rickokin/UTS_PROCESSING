import { pipelineAssetPath } from "../paths";
import { loadJsonFromAbs, loadTextFromAbs } from "@/lib/shared/loader";

const PIPELINE_ID = "insights";

function assetPath(rel: string): string {
  return pipelineAssetPath(PIPELINE_ID, rel);
}

export async function loadInsightsText(relativePath: string): Promise<string> {
  return loadTextFromAbs(assetPath(relativePath));
}

export async function loadInsightsJson<T = any>(relativePath: string): Promise<T> {
  return loadJsonFromAbs<T>(assetPath(relativePath));
}

export async function loadSchemas() {
  const moment = await loadInsightsJson("schemas/moment.schema.v1.json");
  const cluster = await loadInsightsJson("schemas/cluster.schema.v1.json");
  const insight = await loadInsightsJson("schemas/insight.schema.v1.json");
  const report = await loadInsightsJson("schemas/report.schema.v1.json");
  const validation = await loadInsightsJson("schemas/validation.schema.v1.json");
  return { moment, cluster, insight, report, validation };
}

export async function loadPrompts() {
  return {
    segmentIntoMoments: await loadInsightsText("prompts/01_segment_into_moments.txt"),
    clusterMoments: await loadInsightsText("prompts/03_cluster_moments.txt"),
    promoteClusters: await loadInsightsText("prompts/04_promote_clusters_to_insights.txt"),
    assembleReport: await loadInsightsText("prompts/05_assemble_report_outline.txt"),
    validateInsights: await loadInsightsText("prompts/06_validate_insights.txt"),
  };
}

export async function loadAllRulesText(): Promise<string> {
  const clustering = await loadInsightsText("rules/clustering_rules.v1.yaml");
  const promotion = await loadInsightsText("rules/promotion_rules.v1.yaml");
  const autoAssembly = await loadInsightsText("rules/auto_assembly_rules.v1.yaml");

  let validationRules = "";
  try {
    validationRules = await loadInsightsText("rules/validation_rules.v1.yaml");
  } catch {
    // Validation rules may not exist in older setups
  }

  return `
--- CLUSTERING RULES ---
${clustering}

--- PROMOTION RULES ---
${promotion}

--- AUTO-ASSEMBLY RULES ---
${autoAssembly}
${validationRules ? `\n--- VALIDATION RULES ---\n${validationRules}` : ""}
  `.trim();
}

export async function loadAllVocabText(): Promise<string> {
  const enums = await loadInsightsText("vocab/enums.v1.json");
  const emotional = await loadInsightsText("vocab/signals.emotional.v1.json");
  const agency = await loadInsightsText("vocab/signals.agency.v1.json");
  const barrier = await loadInsightsText("vocab/signals.barrier.v1.json");
  const theme = await loadInsightsText("vocab/signals.theme.v1.json");

  return `
--- ENUMS ---
${enums}

--- EMOTIONAL SIGNALS ---
${emotional}

--- AGENCY SIGNALS ---
${agency}

--- BARRIER SIGNALS ---
${barrier}

--- THEME SIGNALS ---
${theme}
  `.trim();
}

export async function loadValidationRulesText(): Promise<string> {
  try {
    return await loadInsightsText("rules/validation_rules.v1.yaml");
  } catch {
    return "";
  }
}
