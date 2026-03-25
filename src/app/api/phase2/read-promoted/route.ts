import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { outputDir } = await req.json();
    if (!outputDir) {
      return NextResponse.json({ error: 'Missing outputDir' }, { status: 400 });
    }

    const filePath = path.join(outputDir, 'promoted_clusters.json');
    
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'promoted_clusters.json does not exist in output directory' }, { status: 404 });
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const insights = JSON.parse(content);

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error('Error reading promoted clusters:', error);
    return NextResponse.json({ error: error.message || 'Error reading promoted clusters' }, { status: 500 });
  }
}
