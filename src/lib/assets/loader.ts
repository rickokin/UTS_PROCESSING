import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { PDFParse } from 'pdf-parse';

export async function loadPdfRules(): Promise<string> {
  const fullPath = path.join(process.cwd(), 'UTS Moment Extraction & Tagging Rules (v1.0).pdf');
  try {
    const dataBuffer = await fs.readFile(fullPath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    return data.text;
  } catch (error) {
    console.error('Error loading PDF rules:', error);
    return '';
  }
}

export async function getAssetPath(relativePath: string) {
  return path.join(process.cwd(), 'src/lib/assets', relativePath);
}

export async function loadText(relativePath: string): Promise<string> {
  const fullPath = await getAssetPath(relativePath);
  return await fs.readFile(fullPath, 'utf-8');
}

export async function loadJson<T = any>(relativePath: string): Promise<T> {
  const content = await loadText(relativePath);
  return JSON.parse(content) as T;
}

export async function loadYaml<T = any>(relativePath: string): Promise<T> {
  const content = await loadText(relativePath);
  return yaml.load(content) as T;
}

// Load all rules into a string representation for prompts
export async function loadAllRulesText(): Promise<string> {
  const clustering = await loadText('rules/clustering_rules.v1.yaml');
  const promotion = await loadText('rules/promotion_rules.v1.yaml');
  const autoAssembly = await loadText('rules/auto_assembly_rules.v1.yaml');
  
  return `
--- CLUSTERING RULES ---
${clustering}

--- PROMOTION RULES ---
${promotion}

--- AUTO-ASSEMBLY RULES ---
${autoAssembly}
  `.trim();
}

// Load all vocabularies into a string representation for prompts
export async function loadAllVocabText(): Promise<string> {
  const enums = await loadText('vocab/enums.v1.json');
  const emotional = await loadText('vocab/signals.emotional.v1.json');
  const agency = await loadText('vocab/signals.agency.v1.json');
  const barrier = await loadText('vocab/signals.barrier.v1.json');
  const theme = await loadText('vocab/signals.theme.v1.json');

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

// Load schemas directly as objects
export async function loadSchemas() {
  const moment = await loadJson('schemas/moment.schema.v1.json');
  const cluster = await loadJson('schemas/cluster.schema.v1.json');
  const insight = await loadJson('schemas/insight.schema.v1.json');
  const report = await loadJson('schemas/report.schema.v1.json');

  return { moment, cluster, insight, report };
}

// Load prompts
export async function loadPrompts() {
  return {
    segmentIntoMoments: await loadText('prompts/01_segment_into_moments.txt'),
    clusterMoments: await loadText('prompts/03_cluster_moments.txt'),
    promoteClusters: await loadText('prompts/04_promote_clusters_to_insights.txt'),
    assembleReport: await loadText('prompts/05_assemble_report_outline.txt'),
  };
}
