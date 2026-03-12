import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadDeliveryManagementState, saveDeliveryManagementState } from '@/lib/server/delivery-management-store';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), '.runtime', 'menu-uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];

type UploadMethod = 'manual' | 'image' | 'document';

interface ParsedMenuItem {
  name: string;
  category: string;
  basePrice: number;
  description?: string;
  items?: string[];
}

interface ParseResult {
  success: boolean;
  items: ParsedMenuItem[];
  warnings: string[];
  source: string;
}

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function isValidImageType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

function isValidDocType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return ALLOWED_DOC_TYPES.includes(mimeType);
}

async function parseImageForMenu(imagePath: string): Promise<ParseResult> {
  // This is a placeholder for OCR-based menu parsing
  // In production, this would call a dedicated OCR service or AI vision API
  // For now, we'll return a structured empty result
  return {
    success: true,
    items: [],
    warnings: ['OCR parsing not yet implemented - please use manual entry or upload a document'],
    source: 'ocr_placeholder',
  };
}

async function parseDocumentForMenu(filePath: string, mimeType: string): Promise<ParseResult> {
  const items: ParsedMenuItem[] = [];
  const warnings: string[] = [];

  try {
    if (mimeType === 'application/pdf') {
      // For PDF, we would use a PDF parser
      warnings.push('PDF parsing requires additional service - please enter items manually');
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      // For Excel/CSV, we would use a spreadsheet parser
      warnings.push('Excel parsing will be available soon - please enter items manually');
    } else if (mimeType === 'text/csv') {
      // For CSV, we can parse directly
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const headers = lines[0]?.split(',').map(h => h.trim()) || [];

      // Simple CSV parsing
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]?.split(',').map(v => v.trim()) || [];
        if (values.length >= 2) {
          items.push({
            name: values[0] || `Item ${i}`,
            category: values[1] || 'General',
            basePrice: parseFloat(values[2] || '0') || 0,
          });
        }
      }
    }
  } catch (error) {
    warnings.push(`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    success: items.length > 0,
    items,
    warnings,
    source: mimeType,
  };
}

async function parseMenuWithAI(content: string, method: UploadMethod): Promise<ParseResult> {
  const items: ParsedMenuItem[] = [];
  const warnings: string[] = [];

  try {
    // Placeholder for AI-based menu parsing
    // In production, this would call OpenAI GPT-4 Vision or similar service
    // For structured data, we can try basic parsing first
    const lines = content.split('\n').filter(line => line.trim());

    // Try to extract menu items from text
    let currentCategory = 'General';
    for (const line of lines) {
      if (line.match(/^(category|分类|section)/i)) {
        currentCategory = line.replace(/^(category|分类|section)\s*[:：]\s*/i, '').trim() || 'General';
        continue;
      }

      // Look for price patterns like "$12.99" or "12.99"
      const priceMatch = line.match(/[$￥¥€]\s*([0-9]+(?:\.[0-9]{1,2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      if (price > 0 && line.length > 2) {
        const name = line.replace(/[$￥¥€][0-9]+(?:\.[0-9]{1,2})?\s*[-—]\s*/gi, '').trim();
        if (name && name.length > 1) {
          items.push({
            name,
            category: currentCategory,
            basePrice: price,
          });
        }
      }
    }

    if (items.length === 0) {
      warnings.push('Could not parse menu items from content. Please enter items manually.');
    }
  } catch (error) {
    warnings.push(`AI parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    success: items.length > 0,
    items,
    warnings,
    source: method,
  };
}

export async function GET() {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const state = await loadDeliveryManagementState(userKey);

  return NextResponse.json({
    ok: true,
    menu: state.menu,
    platforms: state.platforms,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';

  try {
    const formData = await req.formData();
    const method = formData.get('method') as UploadMethod || 'manual';
    const file = formData.get('file') as File | null;

    await ensureUploadDir();

    let parseResult: ParseResult;

    if (method === 'manual') {
      const name = formData.get('name') as string | null;
      const category = formData.get('category') as string | null;
      const basePrice = formData.get('basePrice') as string | null;
      const description = formData.get('description') as string | null;
      const itemsParam = formData.get('items') as string | null;

      const items: ParsedMenuItem[] = [];

      if (name && category && basePrice) {
        items.push({
          name,
          category,
          basePrice: parseFloat(basePrice) || 0,
          description: description || undefined,
          items: itemsParam ? itemsParam.split(',').map(i => i.trim()).filter(Boolean) : undefined,
        });
      }

      parseResult = {
        success: items.length > 0,
        items,
        warnings: [],
        source: 'manual',
      };
    } else if (method === 'image' && file) {
      // Validate image type and size
      if (!isValidImageType(file.type)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Invalid image type. Allowed types: JPEG, PNG, WebP, GIF',
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            error: 'File too large. Maximum size is 10MB',
          },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const fileName = `menu-image-${Date.now()}-${file.name}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      await writeFile(filePath, new Uint8Array(bytes));

      parseResult = await parseImageForMenu(filePath);
    } else if (method === 'document' && file) {
      // Validate document type and size
      if (!isValidDocType(file.type)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Invalid document type. Allowed types: PDF, Excel, CSV',
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            error: 'File too large. Maximum size is 10MB',
          },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const fileName = `menu-doc-${Date.now()}-${file.name}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      await writeFile(filePath, new Uint8Array(bytes));

      parseResult = await parseDocumentForMenu(filePath, file.type);
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid upload method. Must be manual, image, or document',
        },
        { status: 400 }
      );
    }

    // Add parsed items to menu state
    const state = await loadDeliveryManagementState(userKey);

    // Generate new IDs for items
    const existingIds = new Set(state.menu.map(m => m.id));
    const generateId = (base: string) => {
      let id = base;
      let counter = 1;
      while (existingIds.has(id)) {
        id = `${base}-${counter++}`;
      }
      existingIds.add(id);
      return id;
    };

    const newItems = parseResult.items.map((item, index) => ({
      id: generateId(`menu-${Date.now()}-${index}`),
      name: item.name,
      category: item.category,
      basePrice: item.basePrice,
      stock: 'in_stock' as const,
      available: true,
      channels: {},
    }));

    const nextState = {
      ...state,
      menu: [...newItems, ...state.menu],
    };

    await saveDeliveryManagementState(userKey, nextState);

    return NextResponse.json({
      ok: true,
      method,
      items: parseResult.items,
      warnings: parseResult.warnings,
      source: parseResult.source,
      addedCount: newItems.length,
      totalMenuItems: nextState.menu.length,
    });
  } catch (error) {
    console.error('[Menu Upload] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
