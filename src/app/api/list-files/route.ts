import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { uploadDir } = await req.json();
    if (!uploadDir) {
      return NextResponse.json({ error: 'Missing uploadDir' }, { status: 400 });
    }

    try {
      await fs.access(uploadDir);
    } catch {
      // Return empty list if directory does not exist yet
      return NextResponse.json({ files: [] });
    }

    const dirents = await fs.readdir(uploadDir, { withFileTypes: true });
    const files = dirents
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.docx'))
      .map(dirent => ({
        name: dirent.name,
        path: path.join(uploadDir, dirent.name)
      }));

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Error listing files:', error);
    return NextResponse.json({ error: error.message || 'Error listing files' }, { status: 500 });
  }
}
