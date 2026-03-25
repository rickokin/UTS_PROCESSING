import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import fs from 'fs/promises';

export async function POST(req: NextRequest) {
  try {
    let buffer: Buffer;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const { filePath } = await req.json();
      if (!filePath) {
        return NextResponse.json({ error: 'No filePath provided' }, { status: 400 });
      }
      buffer = await fs.readFile(filePath);
    }

    const result = await mammoth.extractRawText({ buffer });
    
    return NextResponse.json({ text: result.value });
  } catch (error: any) {
    console.error('Error parsing docx:', error);
    return NextResponse.json({ error: error.message || 'Error parsing file' }, { status: 500 });
  }
}
