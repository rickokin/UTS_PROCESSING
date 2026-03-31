import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { parseDemographicsCSVText, DemographicRow } from '@/lib/assets/loader';

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
      return NextResponse.json(
        { error: 'No valid demographic rows found in CSV. Check that the file has the expected column layout.' },
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
