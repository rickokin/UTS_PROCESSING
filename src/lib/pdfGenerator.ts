import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BRAND_PINK = '#E91E8C';
const BG_GRAY = '#F5F5F5';
const TEXT_DARK = '#1A1A1A';
const TEXT_GRAY = '#555555';
const TEXT_LIGHT = '#888888';
const CARD_BG = '#FFFFFF';

function getLogoBase64(): string {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  return logoBuffer.toString('base64');
}

function getHeaderTemplate(): string {
  const b64 = getLogoBase64();
  return `
<div style="width:100%;font-size:10px;padding:0;margin:0;position:relative;">
  <div style="position:absolute;top:8px;right:40px;">
    <img src="data:image/png;base64,${b64}" style="height:60px;width:auto;" />
  </div>
</div>`;
}

function getFooterTemplate(): string {
  const year = new Date().getFullYear();
  return `
<div style="width:100%;font-size:10px;font-family:'Helvetica Neue',Arial,sans-serif;padding-top:10px;display:flex;justify-content:space-between;align-items:center;padding-left:48px;padding-right:48px;">
  <span style="color:${TEXT_LIGHT};">Copyright \u00A9${year} Under the Sisterhood, LLC All rights reserved.</span>
  <span style="color:${TEXT_LIGHT};"><span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;
}

function buildPage1(report: any): string {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const summaryItems = (report.executive_summary || [])
    .map((item: string) => `
      <li style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
        <span style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${BRAND_PINK};margin-top:6px;"></span>
        <span style="color:${TEXT_DARK};font-size:14px;line-height:1.65;">${item}</span>
      </li>
    `).join('');

  return `
    <div class="page-section">
      <div style="padding-right:120px;">
        <h1 style="font-family:'Montserrat',sans-serif;font-size:36px;font-weight:800;color:${BRAND_PINK};margin:0 0 10px 0;line-height:1.15;">
          ${report.title || 'Insight Report'}
        </h1>
        ${report.subtitle ? `<p style="font-family:'Inter',sans-serif;font-size:17px;color:${TEXT_GRAY};margin:0 0 20px 0;line-height:1.5;font-weight:400;">${report.subtitle}</p>` : ''}
        <p style="font-family:'Inter',sans-serif;font-size:12px;color:${TEXT_LIGHT};margin:0 0 16px 0;">Generated: ${date}</p>
        <div style="border-bottom:3px solid ${BRAND_PINK};margin-bottom:40px;width:100%;"></div>
      </div>

      <div style="margin-top:20px;">
        <h2 class="section-header">Executive Summary</h2>
        <div style="background:${CARD_BG};border-radius:10px;padding:30px 35px;">
          <ul style="list-style:none;margin:0;padding:0;">
            ${summaryItems}
          </ul>
        </div>
      </div>
    </div>`;
}

function buildPage2(report: any): string {
  const d = report.participant_demographics;
  if (!d) return '';

  const maxBracketCount = Math.max(...(d.age_brackets || []).map((b: any) => b.count), 1);

  const summaryCards = [
    { value: d.total_participants, label: 'PARTICIPANTS' },
    { value: `${d.age.min}\u2013${d.age.max}`, label: 'AGE RANGE' },
    { value: d.ethnicity_breakdown.length, label: 'ETHNIC BACKGROUNDS' },
    { value: d.geographic_scope.regions.length, label: 'REGIONS' },
  ].map(c => `
    <div style="flex:1;background:${BRAND_PINK};border-radius:10px;padding:18px 10px;text-align:center;">
      <div style="font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;color:#FFFFFF;">${c.value}</div>
      <div style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:2px;margin-top:6px;">${c.label}</div>
    </div>
  `).join('');

  const ageBars = (d.age_brackets || []).map((b: any) => {
    const pct = Math.round((b.count / maxBracketCount) * 100);
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:11px;color:${TEXT_GRAY};width:36px;text-align:right;font-variant-numeric:tabular-nums;">${b.bracket}</span>
        <div style="flex:1;background:#E0E0E0;border-radius:6px;height:14px;overflow:hidden;">
          <div style="background:${BRAND_PINK};height:100%;border-radius:6px;width:${pct}%;"></div>
        </div>
        <span style="font-size:11px;color:${TEXT_DARK};font-weight:600;width:20px;text-align:right;">${b.count}</span>
      </div>`;
  }).join('');

  const ethnicityRows = (d.ethnicity_breakdown || []).map((e: any) => `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
      <span style="font-size:13px;color:${TEXT_DARK};">${e.group}</span>
      <span style="font-size:11px;color:${TEXT_GRAY};font-weight:500;">${e.count} (${e.pct}%)</span>
    </div>
  `).join('');

  const regionRows = (d.geographic_scope.regions || []).slice(0, 8).map((r: any) => `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
      <span style="font-size:13px;color:${TEXT_DARK};">${r.region}</span>
      <span style="font-size:11px;color:${TEXT_DARK};font-weight:600;">${r.count}</span>
    </div>
  `).join('');

  const moreRegions = d.geographic_scope.regions.length > 8
    ? `<div style="font-size:11px;color:${TEXT_LIGHT};margin-top:6px;">+ ${d.geographic_scope.regions.length - 8} more</div>`
    : '';

  return `
    <div class="page-section page-break-before">
      <h2 class="section-header">Participant Demographics</h2>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${summaryCards}
      </div>

      <div style="display:flex;gap:12px;">
        <div style="flex:1;background:${CARD_BG};border-radius:10px;padding:20px;">
          <h3 class="panel-header">Age Distribution</h3>
          ${ageBars}
          <p style="font-size:11px;color:${TEXT_LIGHT};margin:12px 0 0 0;">Mean: ${d.age.mean} | Median: ${d.age.median}</p>
        </div>

        <div style="flex:1;background:${CARD_BG};border-radius:10px;padding:20px;">
          <h3 class="panel-header">Ethnicity</h3>
          ${ethnicityRows}
        </div>

        <div style="flex:1;background:${CARD_BG};border-radius:10px;padding:20px;">
          <h3 class="panel-header">Geographic Scope</h3>
          <div style="display:flex;gap:24px;margin-bottom:14px;">
            <div style="text-align:center;">
              <div style="font-size:22px;font-weight:900;color:${TEXT_DARK};">${d.geographic_scope.domestic_count}</div>
              <div style="font-size:10px;color:${TEXT_LIGHT};">US-Based</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:22px;font-weight:900;color:${TEXT_DARK};">${d.geographic_scope.international_count}</div>
              <div style="font-size:10px;color:${TEXT_LIGHT};">International</div>
            </div>
          </div>
          ${regionRows}
          ${moreRegions}
        </div>
      </div>
    </div>`;
}

function buildInsightsSection(report: any): string {
  if (!report.key_insights || report.key_insights.length === 0) return '';

  const insightBlocks = report.key_insights.map((insight: any) => {
    const quotes = (insight.quotes || []).map((q: any) => `
      <div style="background:${BRAND_PINK};border-radius:12px;padding:24px 22px;flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;">
        <p style="color:#FFFFFF;font-size:13px;font-style:italic;line-height:1.65;margin:0 0 16px 0;">
          \u201C${q.quote}\u201D
        </p>
        <div>
          <p style="color:#FFFFFF;font-size:11px;font-weight:700;margin:0;text-transform:uppercase;">
            \u2014 ${q.speaker_role}
          </p>
          <p style="color:#FFFFFF;font-size:10px;margin:4px 0 0 0;text-transform:uppercase;letter-spacing:0.5px;">
            EP. ${q.episode_id}
          </p>
        </div>
      </div>
    `).join('');

    return `
      <div class="insight-block">
        <p style="font-family:'Inter',sans-serif;font-size:16px;font-weight:600;color:${TEXT_DARK};line-height:1.6;margin:0 0 18px 0;">
          ${insight.insight_statement}
        </p>
        <div style="display:flex;gap:14px;">
          ${quotes}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page-section page-break-before">
      <h2 class="section-header">Key Insights</h2>
      ${insightBlocks}
    </div>`;
}

function buildMethodologySection(report: any): string {
  const m = report.methodology;
  if (!m) return '';

  const cards = [
    { value: m.episodes_analyzed ?? '—', label: 'EPISODES ANALYZED' },
    { value: m.moments_segmented ?? '—', label: 'MOMENTS SEGMENTED' },
  ].map(c => `
    <div style="flex:1;background:${CARD_BG};border-radius:10px;padding:28px 20px;text-align:center;">
      <div style="font-family:'Montserrat',sans-serif;font-size:36px;font-weight:900;color:${TEXT_DARK};">${c.value}</div>
      <div style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:${TEXT_LIGHT};text-transform:uppercase;letter-spacing:2px;margin-top:8px;">${c.label}</div>
    </div>
  `).join('');

  return `
    <div class="page-section page-break-before">
      <h2 class="section-header">Methodology</h2>
      <div style="display:flex;gap:14px;margin-bottom:24px;">
        ${cards}
      </div>
      ${m.confidence_threshold ? `
      <div style="background:${CARD_BG};border-radius:10px;padding:22px 28px;">
        <h3 class="panel-header">Confidence Threshold</h3>
        <p style="font-size:14px;color:${TEXT_DARK};line-height:1.65;margin:0;">${m.confidence_threshold}</p>
      </div>` : ''}
    </div>`;
}

export async function generatePDF(report: any, outputPath: string) {
  const page1 = buildPage1(report);
  const page2 = buildPage2(report);
  const insightsSection = buildInsightsSection(report);
  const methodologySection = buildMethodologySection(report);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title || 'Insight Report'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800;900&display=swap');
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', sans-serif;
      background: ${BG_GRAY};
      color: ${TEXT_DARK};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-section {
      padding: 0 10px;
    }

    .page-break-before {
      page-break-before: always;
    }

    .section-header {
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: ${BRAND_PINK};
      text-transform: uppercase;
      letter-spacing: 3px;
      margin: 0 0 20px 0;
    }

    .panel-header {
      font-family: 'Montserrat', sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: ${TEXT_GRAY};
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0 0 14px 0;
    }

    .insight-block {
      margin-bottom: 36px;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${page1}
  ${page2}
  ${insightsSection}
  ${methodologySection}
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: getHeaderTemplate(),
    footerTemplate: getFooterTemplate(),
    margin: {
      top: '110px',
      right: '45px',
      bottom: '55px',
      left: '45px'
    }
  });

  await browser.close();
  return outputPath;
}

// ---------------------------------------------------------------------------
//  Validation Report PDF
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  supported:          { label: 'Supported',           color: '#16a34a', bg: '#f0fdf4' },
  partially_supported:{ label: 'Partially Supported', color: '#ca8a04', bg: '#fefce8' },
  not_supported:      { label: 'Not Supported',       color: '#dc2626', bg: '#fef2f2' },
  not_addressed:      { label: 'Not Addressed',       color: '#6b7280', bg: '#f9fafb' },
};

function buildValidationPage1(validation: any): string {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const statusCounts: Record<string, number> = {};
  (validation.insight_validations || []).forEach((iv: any) => {
    statusCounts[iv.validation_status] = (statusCounts[iv.validation_status] || 0) + 1;
  });

  const totalInsights = validation.insight_validations?.length || 0;
  const gapCount = validation.insights_not_in_external?.length || 0;
  const novelCount = validation.external_findings_not_in_extracted?.length || 0;

  const statusCards = ['supported', 'partially_supported', 'not_supported', 'not_addressed']
    .map(status => {
      const s = STATUS_STYLES[status];
      const count = statusCounts[status] || 0;
      return `
        <div style="flex:1;border-radius:10px;padding:18px 10px;text-align:center;background:${s.bg};border:2px solid ${s.color};">
          <div style="font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;color:${s.color};">${count}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:${s.color};text-transform:uppercase;letter-spacing:2px;margin-top:6px;">${s.label}</div>
        </div>`;
    }).join('');

  return `
    <div class="page-section">
      <div style="padding-right:120px;">
        <h1 style="font-family:'Montserrat',sans-serif;font-size:32px;font-weight:800;color:${BRAND_PINK};margin:0 0 8px 0;line-height:1.15;">
          External Research Validation Report
        </h1>
        <p style="font-family:'Inter',sans-serif;font-size:15px;color:${TEXT_GRAY};margin:0 0 6px 0;line-height:1.5;">
          Validation of extracted insights against external research literature
        </p>
        <p style="font-family:'Inter',sans-serif;font-size:12px;color:${TEXT_LIGHT};margin:0 0 16px 0;">Generated: ${date}</p>
        <div style="border-bottom:3px solid ${BRAND_PINK};margin-bottom:32px;width:100%;"></div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:28px;">
        <div style="flex:1;background:${BRAND_PINK};border-radius:10px;padding:18px 10px;text-align:center;">
          <div style="font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;color:#FFFFFF;">${totalInsights}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:2px;margin-top:6px;">Insights Validated</div>
        </div>
        <div style="flex:1;background:${BRAND_PINK};border-radius:10px;padding:18px 10px;text-align:center;">
          <div style="font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;color:#FFFFFF;">${gapCount}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:2px;margin-top:6px;">Coverage Gaps</div>
        </div>
        <div style="flex:1;background:${BRAND_PINK};border-radius:10px;padding:18px 10px;text-align:center;">
          <div style="font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;color:#FFFFFF;">${novelCount}</div>
          <div style="font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:2px;margin-top:6px;">Novel External Findings</div>
        </div>
      </div>

      <h2 class="section-header">Validation Status Distribution</h2>
      <div style="display:flex;gap:12px;margin-bottom:28px;">
        ${statusCards}
      </div>

      <h2 class="section-header">Overall Alignment Summary</h2>
      <div style="background:${CARD_BG};border-radius:10px;padding:24px 28px;">
        <p style="font-size:13px;color:${TEXT_DARK};line-height:1.7;margin:0;">${validation.overall_alignment_summary || ''}</p>
      </div>

      ${validation.external_source_summary ? `
      <div style="margin-top:20px;">
        <h2 class="section-header">External Source</h2>
        <div style="background:${CARD_BG};border-radius:10px;padding:20px 28px;">
          <p style="font-size:12px;color:${TEXT_GRAY};line-height:1.65;margin:0;">${validation.external_source_summary}</p>
        </div>
      </div>` : ''}
    </div>`;
}

function buildValidationInsightPages(validation: any): string {
  const validations = validation.insight_validations || [];
  if (validations.length === 0) return '';

  const cards = validations.map((iv: any) => {
    const s = STATUS_STYLES[iv.validation_status] || STATUS_STYLES.not_addressed;

    const excerpts = (iv.relevant_external_excerpts || []).map((e: string) => `
      <div style="border-left:3px solid ${BRAND_PINK};padding:6px 0 6px 14px;margin-bottom:8px;">
        <p style="font-size:11px;color:${TEXT_GRAY};font-style:italic;line-height:1.55;margin:0;">\u201C${e}\u201D</p>
      </div>
    `).join('');

    return `
      <div class="insight-block" style="background:${CARD_BG};border-radius:10px;padding:22px 26px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <p style="font-size:14px;font-weight:600;color:${TEXT_DARK};line-height:1.5;margin:0;flex:1;padding-right:16px;">${iv.insight_title}</p>
          <span style="flex-shrink:0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 12px;border-radius:20px;background:${s.bg};color:${s.color};border:1.5px solid ${s.color};">${s.label}</span>
        </div>
        <div style="margin-bottom:10px;">
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${TEXT_LIGHT};margin:0 0 4px 0;">External Evidence</p>
          <p style="font-size:12px;color:${TEXT_DARK};line-height:1.6;margin:0;">${iv.external_evidence_summary}</p>
        </div>
        ${iv.alignment_notes ? `
        <div style="margin-bottom:10px;">
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${TEXT_LIGHT};margin:0 0 4px 0;">Alignment Notes</p>
          <p style="font-size:12px;color:${TEXT_GRAY};line-height:1.6;margin:0;">${iv.alignment_notes}</p>
        </div>` : ''}
        ${excerpts ? `
        <div>
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${TEXT_LIGHT};margin:0 0 8px 0;">Excerpts from External Research</p>
          ${excerpts}
        </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="page-section page-break-before">
      <h2 class="section-header">Insight-by-Insight Validation</h2>
      ${cards}
    </div>`;
}

function buildValidationGapsSection(validation: any): string {
  const gaps = validation.insights_not_in_external || [];
  if (gaps.length === 0) return '';

  const rows = gaps.map((g: any) => `
    <div style="background:${CARD_BG};border-radius:10px;padding:18px 24px;margin-bottom:10px;">
      <p style="font-size:13px;font-weight:600;color:${TEXT_DARK};margin:0 0 6px 0;">${g.insight_title}</p>
      <p style="font-size:11px;color:${TEXT_GRAY};line-height:1.55;margin:0;">${g.gap_note}</p>
    </div>`).join('');

  return `
    <div class="page-section page-break-before">
      <h2 class="section-header">Insights Not Found in External Research</h2>
      <p style="font-size:12px;color:${TEXT_GRAY};margin:0 0 16px 0;">
        These insights from the transcript analysis have no corresponding coverage in the external research document.
      </p>
      ${rows}
    </div>`;
}

function buildNovelFindingsSection(validation: any): string {
  const findings = validation.external_findings_not_in_extracted || [];
  if (findings.length === 0) return '';

  const rows = findings.map((f: any) => `
    <div style="background:${CARD_BG};border-radius:10px;padding:18px 24px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <p style="font-size:13px;font-weight:600;color:${TEXT_DARK};margin:0;">${f.finding_title}</p>
        <span style="font-size:9px;font-weight:600;padding:3px 10px;border-radius:12px;background:${BRAND_PINK}20;color:${BRAND_PINK};text-transform:capitalize;">${(f.suggested_insight_type || '').replace(/_/g, ' ')}</span>
      </div>
      <p style="font-size:12px;color:${TEXT_DARK};line-height:1.6;margin:0 0 8px 0;">${f.finding_summary}</p>
      <p style="font-size:11px;color:${TEXT_GRAY};line-height:1.5;margin:0;">
        <strong style="color:${TEXT_DARK};">Relevance:</strong> ${f.relevance_to_study}
      </p>
    </div>`).join('');

  return `
    <div class="page-section page-break-before">
      <h2 class="section-header">Novel Findings from External Research</h2>
      <p style="font-size:12px;color:${TEXT_GRAY};margin:0 0 16px 0;">
        These substantive themes were found in the external research but are not captured by any of the extracted insights.
      </p>
      ${rows}
    </div>`;
}

export async function generateValidationPDF(validation: any, outputPath: string) {
  const page1 = buildValidationPage1(validation);
  const insightPages = buildValidationInsightPages(validation);
  const gapsSection = buildValidationGapsSection(validation);
  const novelSection = buildNovelFindingsSection(validation);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>External Research Validation Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800;900&display=swap');
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', sans-serif;
      background: ${BG_GRAY};
      color: ${TEXT_DARK};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-section { padding: 0 10px; }
    .page-break-before { page-break-before: always; }
    .section-header {
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: ${BRAND_PINK};
      text-transform: uppercase;
      letter-spacing: 3px;
      margin: 0 0 20px 0;
    }
    .panel-header {
      font-family: 'Montserrat', sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: ${TEXT_GRAY};
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0 0 14px 0;
    }
    .insight-block { page-break-inside: avoid; }
  </style>
</head>
<body>
  ${page1}
  ${insightPages}
  ${gapsSection}
  ${novelSection}
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: getHeaderTemplate(),
    footerTemplate: getFooterTemplate(),
    margin: {
      top: '110px',
      right: '45px',
      bottom: '55px',
      left: '45px'
    }
  });

  await browser.close();
  return outputPath;
}
