import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { parseDemographicsCSVText, parseCSVLine, resolveColumnIndices, DemographicRow } from '@/lib/shared/loader';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const outputDir = formData.get('outputDir') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });
    }
    if (!outputDir) {
      return NextResponse.json({ error: 'No output directory specified' }, { status: 400 });
    }

    const csvText = await file.text();
    const rows: DemographicRow[] = parseDemographicsCSVText(csvText);

    if (rows.length === 0) {
      const lines = csvText.split('\n').filter(l => l.trim().length > 0);
      const headerFields = lines.length > 0 ? parseCSVLine(lines[0]) : [];
      const col = resolveColumnIndices(headerFields);
      const missing = (['filename', 'age', 'location', 'ethnicity'] as const)
        .filter(k => col[k] === -1);

      const hint = missing.length > 0
        ? ` Could not detect column(s): ${missing.join(', ')}. Ensure the header row contains recognisable column names (e.g. Filename, Age, Location, Ethnicity).`
        : ' The header was recognised but no valid data rows were found.';

      return NextResponse.json(
        { error: `No valid demographic rows found in CSV.${hint}` },
        { status: 400 }
      );
    }

    await fs.mkdir(outputDir, { recursive: true });
    const outPath = path.join(outputDir, 'demographics.json');
    await fs.writeFile(outPath, JSON.stringify(rows, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      path: outPath,
      rowCount: rows.length,
    });
  } catch (error: any) {
    console.error('Error processing demographics CSV:', error);
    return NextResponse.json({ error: error.message || 'Failed to process CSV' }, { status: 500 });
  }
}
