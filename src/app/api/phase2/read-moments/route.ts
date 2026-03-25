import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { outputDir } = await req.json();
    if (!outputDir) {
      return NextResponse.json({ error: 'Missing outputDir' }, { status: 400 });
    }

    try {
      await fs.access(outputDir);
    } catch {
      return NextResponse.json({ error: 'Output directory does not exist' }, { status: 400 });
    }

    const files = await fs.readdir(outputDir);
    const momentFiles = files.filter(f => f.endsWith('_moments_tagged.json'));

    let allMoments: any[] = [];
    for (const file of momentFiles) {
      const filePath = path.join(outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      try {
        const moments = JSON.parse(content);
        if (Array.isArray(moments)) {
          allMoments = allMoments.concat(moments);
        }
      } catch (e) {
        console.error(`Failed to parse ${filePath}`);
      }
    }

    return NextResponse.json({ moments: allMoments });
  } catch (error: any) {
    console.error('Error reading moments:', error);
    return NextResponse.json({ error: error.message || 'Error reading moments' }, { status: 500 });
  }
}
