import { NextResponse } from 'next/server';
import { parseOpsUploads } from '@/lib/server/ops-document-parser';

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid upload payload.' }, { status: 400 });
  }

  const files = formData
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
  }

  const documents = await parseOpsUploads(files);
  return NextResponse.json({
    uploadedCount: documents.length,
    parsedCount: documents.filter((doc) => doc.parsingStatus === 'parsed').length,
    documents,
  });
}
