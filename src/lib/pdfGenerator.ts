import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export async function generatePDF(report: any, outputPath: string) {
  // Build a beautiful HTML string using Tailwind via CDN
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title || 'Insight Report'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      background-color: #ffffff;
      color: #1f2937;
      -webkit-print-color-adjust: exact;
    }
    /* Page break helpers for printing */
    .page-break-before { page-break-before: always; }
    .avoid-page-break { page-break-inside: avoid; }
  </style>
</head>
<body class="p-12 max-w-4xl mx-auto">
  
  <!-- Header -->
  <header class="border-b-2 border-indigo-100 pb-8 mb-10">
    <h1 class="text-4xl font-extrabold text-gray-900 tracking-tight">${report.title || 'Insight Report'}</h1>
    ${report.subtitle ? `<p class="mt-3 text-xl text-gray-500 font-medium">${report.subtitle}</p>` : ''}
    <div class="mt-6 flex items-center space-x-4 text-sm text-gray-400 font-medium">
      <span>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </div>
  </header>

  <!-- Executive Summary -->
  ${report.executive_summary && report.executive_summary.length > 0 ? `
  <section class="mb-12 avoid-page-break">
    <h2 class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Executive Summary</h2>
    <div class="bg-gray-50 rounded-xl p-6 border border-gray-100">
      <ul class="space-y-3">
        ${report.executive_summary.map((item: string) => `
          <li class="flex items-start">
            <span class="flex-shrink-0 h-1.5 w-1.5 mt-2 rounded-full bg-indigo-500 mr-3"></span>
            <span class="text-gray-700 leading-relaxed">${item}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  </section>
  ` : ''}

  <!-- Key Insights -->
  ${report.key_insights && report.key_insights.length > 0 ? `
  <section class="mb-12">
    <h2 class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-6">Key Insights</h2>
    <div class="space-y-10">
      ${report.key_insights.map((insight: any) => `
        <div class="avoid-page-break">
          <h3 class="text-xl font-bold text-gray-900 mb-5 leading-snug">${insight.insight_statement}</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            ${(insight.quotes || []).map((q: any) => `
              <div class="bg-white p-5 rounded-lg border-l-4 border-indigo-400 shadow-sm border-y border-r border-gray-100">
                <p class="text-gray-600 italic text-sm leading-relaxed mb-3">"${q.quote}"</p>
                <div class="flex items-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <span class="text-indigo-600 mr-1">—</span>
                  ${q.speaker_role} <span class="mx-1.5 text-gray-300">•</span> Ep. ${q.episode_id}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </section>
  ` : ''}

  <!-- Methodology -->
  ${report.methodology ? `
  <section class="mb-8 avoid-page-break">
    <h2 class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Methodology</h2>
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-6 grid grid-cols-3 gap-4 text-center">
      <div>
        <p class="text-3xl font-black text-slate-700">${report.methodology.episodes_analyzed || 0}</p>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Episodes</p>
      </div>
      <div class="border-x border-slate-200">
        <p class="text-3xl font-black text-slate-700">${report.methodology.moments_segmented || 0}</p>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Moments</p>
      </div>
      <div>
        <p class="text-xl font-black text-slate-700 mt-1">${report.methodology.confidence_threshold || 'N/A'}</p>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2">Confidence</p>
      </div>
    </div>
  </section>
  ` : ''}

</body>
</html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set the HTML content
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  // Ensure the output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate the PDF
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px'
    }
  });

  await browser.close();
  return outputPath;
}
