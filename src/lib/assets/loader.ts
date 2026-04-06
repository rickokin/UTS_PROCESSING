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
  
  let validationRules = '';
  try {
    validationRules = await loadText('rules/validation_rules.v1.yaml');
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
${validationRules ? `\n--- VALIDATION RULES ---\n${validationRules}` : ''}
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

  const validation = await loadJson('schemas/validation.schema.v1.json');

  return { moment, cluster, insight, report, validation };
}

// Load prompts
export async function loadPrompts() {
  return {
    segmentIntoMoments: await loadText('prompts/01_segment_into_moments.txt'),
    clusterMoments: await loadText('prompts/03_cluster_moments.txt'),
    promoteClusters: await loadText('prompts/04_promote_clusters_to_insights.txt'),
    assembleReport: await loadText('prompts/05_assemble_report_outline.txt'),
    validateInsights: await loadText('prompts/06_validate_insights.txt'),
  };
}

// --- External Research ---

export interface ExternalResearch {
  filename: string;
  extracted_text: string;
  uploaded_at: string;
}

export async function loadExternalResearch(outputDir: string): Promise<ExternalResearch | null> {
  const jsonPath = path.join(outputDir, 'external_research.json');
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(content) as ExternalResearch;
  } catch {
    return null;
  }
}

export async function loadValidationFromOutput(outputDir: string): Promise<any | null> {
  const jsonPath = path.join(outputDir, 'validation.json');
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// --- Demographics ---

export interface DemographicRow {
  filename: string;
  name: string;
  age: number;
  location: string;
  ethnicity: string;
}

export interface DemographicsSummary {
  total_participants: number;
  age: { min: number; max: number; mean: number; median: number };
  age_brackets: { bracket: string; count: number }[];
  ethnicity_breakdown: { group: string; count: number; pct: number }[];
  geographic_scope: {
    domestic_count: number;
    international_count: number;
    regions: { region: string; count: number }[];
  };
}

export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

const COLUMN_ALIASES: Record<keyof DemographicRow, string[]> = {
  filename: ['filename', 'file name', 'file', 'filenames', 'file_name', 'episode', 'episode id', 'episode_id', 'transcript'],
  name:     ['name', 'participant', 'participant name', 'participant_name', 'interviewee', 'guest', 'speaker'],
  age:      ['age', 'years old', 'participant age', 'participant_age'],
  location: ['location', 'city', 'state', 'region', 'country', 'city/state', 'city state', 'geography', 'place', 'address'],
  ethnicity:['ethnicity', 'ethnic', 'ethnic group', 'race', 'race/ethnicity', 'race ethnicity', 'background', 'ethnic background', 'cultural background'],
};

export function resolveColumnIndices(headerFields: string[]): Record<keyof DemographicRow, number> {
  const normalized = headerFields.map(h => h.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const mapping: Record<string, number> = {} as any;

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [keyof DemographicRow, string[]][]) {
    let bestIdx = -1;
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) { bestIdx = idx; break; }
    }
    if (bestIdx === -1) {
      for (const alias of aliases) {
        const idx = normalized.findIndex(h => h.includes(alias) || alias.includes(h));
        if (idx !== -1) { bestIdx = idx; break; }
      }
    }
    mapping[key] = bestIdx;
  }

  return mapping as Record<keyof DemographicRow, number>;
}

export function parseDemographicsCSVText(csvText: string): DemographicRow[] {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerFields = parseCSVLine(lines[0]);
  const col = resolveColumnIndices(headerFields);

  const hasHeaderMatch = col.filename !== -1 || col.age !== -1 || col.location !== -1 || col.ethnicity !== -1;

  if (!hasHeaderMatch) {
    col.filename  = 1;
    col.name      = 2;
    col.age       = 6;
    col.location  = 7;
    col.ethnicity = 8;
  }

  return lines.slice(1).map(line => {
    const fields = parseCSVLine(line);
    return {
      filename:  col.filename  !== -1 ? (fields[col.filename]  || '') : '',
      name:      col.name      !== -1 ? (fields[col.name]      || '') : '',
      age:       col.age       !== -1 ? (parseInt(fields[col.age], 10) || 0) : 0,
      location:  col.location  !== -1 ? (fields[col.location]  || '') : '',
      ethnicity: col.ethnicity !== -1 ? (fields[col.ethnicity] || '') : '',
    };
  }).filter(r => r.filename.length > 0);
}

export async function loadDemographicsCSV(): Promise<DemographicRow[]> {
  const csvText = await loadText('data/UTS_S4_Demographics.csv');
  return parseDemographicsCSVText(csvText);
}

export async function loadDemographicsFromOutput(outputDir: string): Promise<DemographicRow[] | null> {
  const jsonPath = path.join(outputDir, 'demographics.json');
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const rows = JSON.parse(content) as DemographicRow[];
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

const US_STATE_NAMES = new Set([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
]);

const US_CITY_INDICATORS = ['NYC', 'NY', 'NJ', 'CA', 'CT', 'TX', 'FL', 'PA', 'MA', 'MD', 'AZ', 'MO', 'GA', 'RI', 'WI'];

function isUSDomestic(location: string): boolean {
  const loc = location.trim();
  const lower = loc.toLowerCase();
  if (US_STATE_NAMES.has(lower)) return true;
  if (US_STATES.has(loc.toUpperCase())) return true;
  // Check if last segment after comma is a US state abbreviation or name
  const parts = loc.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (US_STATES.has(last.toUpperCase())) return true;
    if (US_STATE_NAMES.has(last.toLowerCase())) return true;
  }
  if (lower === 'nyc' || lower === 'new york') return true;
  return false;
}

function getRegionLabel(location: string): string {
  const loc = location.trim();
  const parts = loc.split(',').map(p => p.trim());
  if (isUSDomestic(loc)) {
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
    return loc;
  }
  // International — return the country-level part
  if (parts.length >= 2) return parts[parts.length - 1];
  return loc;
}

export function computeDemographicsSummary(
  rows: DemographicRow[],
  episodeIds?: Set<string>
): DemographicsSummary {
  let filtered = rows;
  if (episodeIds && episodeIds.size > 0) {
    filtered = rows.filter(r => {
      const normalized = r.filename.replace(/\.docx$/i, '');
      return episodeIds.has(normalized) || episodeIds.has(r.filename);
    });
  }
  if (filtered.length === 0) filtered = rows;

  const ages = filtered.map(r => r.age).filter(a => a > 0).sort((a, b) => a - b);
  const ageMin = ages[0] ?? 0;
  const ageMax = ages[ages.length - 1] ?? 0;
  const ageMean = ages.length > 0 ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : 0;
  const ageMedian = ages.length > 0
    ? ages.length % 2 === 0
      ? (ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2
      : ages[Math.floor(ages.length / 2)]
    : 0;

  const brackets = [
    { bracket: '18-24', min: 18, max: 24 },
    { bracket: '25-34', min: 25, max: 34 },
    { bracket: '35-44', min: 35, max: 44 },
    { bracket: '45-54', min: 45, max: 54 },
    { bracket: '55-64', min: 55, max: 64 },
    { bracket: '65+', min: 65, max: 999 },
  ];
  const ageBrackets = brackets.map(b => ({
    bracket: b.bracket,
    count: ages.filter(a => a >= b.min && a <= b.max).length,
  })).filter(b => b.count > 0);

  const ethnicityCounts = new Map<string, number>();
  for (const r of filtered) {
    const group = r.ethnicity.trim() || 'Unknown';
    ethnicityCounts.set(group, (ethnicityCounts.get(group) || 0) + 1);
  }
  const ethnicityBreakdown = Array.from(ethnicityCounts.entries())
    .map(([group, count]) => ({
      group,
      count,
      pct: Math.round((count / filtered.length) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  let domesticCount = 0;
  let internationalCount = 0;
  const regionCounts = new Map<string, number>();
  for (const r of filtered) {
    if (isUSDomestic(r.location)) {
      domesticCount++;
    } else {
      internationalCount++;
    }
    const region = getRegionLabel(r.location);
    regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
  }
  const regions = Array.from(regionCounts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total_participants: filtered.length,
    age: { min: ageMin, max: ageMax, mean: ageMean, median: ageMedian },
    age_brackets: ageBrackets,
    ethnicity_breakdown: ethnicityBreakdown,
    geographic_scope: {
      domestic_count: domesticCount,
      international_count: internationalCount,
      regions,
    },
  };
}
