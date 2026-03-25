import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { filename, stage, data, outputDir } = await req.json();
    
    if (!filename || !data || !outputDir) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Sanitize filename (remove extension for prefix)
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const safeBaseName = baseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const outPath = stage 
      ? path.join(outputDir, `${safeBaseName}_${stage}.json`)
      : path.join(outputDir, `${safeBaseName}.json`);
    
    await fs.writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, path: outPath });
  } catch (error: any) {
    console.error('Error writing file:', error);
    return NextResponse.json({ error: error.message || 'Error writing file' }, { status: 500 });
  }
}
