import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { isKnownPipelineId } from '@/lib/pipelines/registry';
import { pipelineOutputDir } from '@/lib/pipelines/paths';

export async function POST(req: NextRequest) {
  try {
    const { filename, stage, data, outputDir, pipelineId } = await req.json();

    if (!filename || !data || !outputDir) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // When a pipelineId is provided, scope the write to <outputDir>/<pipelineId>/
    // so each pipeline's artifacts stay isolated. Validate against the registry
    // to avoid arbitrary subpath writes.
    let targetDir = outputDir;
    if (pipelineId) {
      if (!isKnownPipelineId(pipelineId)) {
        return NextResponse.json({ error: `Unknown pipeline '${pipelineId}'` }, { status: 400 });
      }
      targetDir = pipelineOutputDir(outputDir, pipelineId);
    }

    await fs.mkdir(targetDir, { recursive: true });

    const baseName = filename.replace(/\.[^/.]+$/, "");
    const safeBaseName = baseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const outPath = stage
      ? path.join(targetDir, `${safeBaseName}_${stage}.json`)
      : path.join(targetDir, `${safeBaseName}.json`);

    await fs.writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, path: outPath });
  } catch (error: any) {
    console.error('Error writing file:', error);
    return NextResponse.json({ error: error.message || 'Error writing file' }, { status: 500 });
  }
}
