import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const { basePath } = await req.json();
  // Ruta al archivo donde está el enum SchemaEnum
  const enumFile = path.join(basePath, 'src/database/schema/schema.enum.ts');
  const enumName = 'SchemaEnum';

  try {
    const fileContent = readFileSync(enumFile, 'utf-8');
    // Regex para extraer los valores del enum
    const enumRegex = new RegExp(`export\\s+enum\\s+${enumName}\\s*{([\\s\\S]*?)}`,'m');
    const match = fileContent.match(enumRegex);

    if (!match) {
      return NextResponse.json({ error: 'Enum no encontrado' }, { status: 404 });
    }

    // Extraer los valores del enum
    const values = match[1]
      .split(',')
      .map(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
          return parts[1].replace(/['"`\s]/g, '');
        }
        return null;
      })
      .filter(Boolean);

    return NextResponse.json({ values });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 