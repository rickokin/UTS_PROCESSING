import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const outputDir = formData.get('outputDir') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!outputDir) {
      return NextResponse.json({ error: 'No output directory specified' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';

    if (filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (filename.endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      extractedText = data.text;
    } else if (filename.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.' },
        { status: 400 }
      );
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text could be extracted from the uploaded file.' },
        { status: 400 }
      );
    }

    await fs.mkdir(outputDir, { recursive: true });
    const outPath = path.join(outputDir, 'external_research.json');
    await fs.writeFile(
      outPath,
      JSON.stringify(
        {
          filename: file.name,
          extracted_text: extractedText,
          uploaded_at: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      path: outPath,
      charCount: extractedText.length,
    });
  } catch (error: any) {
    console.error('Error processing research document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process research document' },
      { status: 500 }
    );
  }
}
