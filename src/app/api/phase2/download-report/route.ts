import { generatePDF } from '@/lib/pdfGenerator';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: Request) {
  try {
    const { report } = await req.json();
    if (!report) {
      return new Response(JSON.stringify({ error: 'No report provided' }), { status: 400 });
    }

    const tmpPath = path.join(os.tmpdir(), `report_${Date.now()}.pdf`);
    await generatePDF(report, tmpPath);

    const buffer = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Download Report Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
