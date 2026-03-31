import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { outputDir } = await req.json();
    if (!outputDir) {
      return NextResponse.json({ error: 'Missing outputDir' }, { status: 400 });
    }

    let validation = null;
    let hasExternalResearch = false;

    // Check for validation.json
    const validationPath = path.join(outputDir, 'validation.json');
    try {
      await fs.access(validationPath);
      const content = await fs.readFile(validationPath, 'utf-8');
      validation = JSON.parse(content);
    } catch {}

    // Check for external_research.json
    const researchPath = path.join(outputDir, 'external_research.json');
    try {
      await fs.access(researchPath);
      hasExternalResearch = true;
    } catch {}

    return NextResponse.json({ validation, hasExternalResearch });
  } catch (error: any) {
    console.error('Error reading validation status:', error);
    return NextResponse.json({ error: error.message || 'Error reading validation status' }, { status: 500 });
  }
}
