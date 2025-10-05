import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const { basePath } = await req.json();
  const entitiesDir = path.join(basePath, 'src/persistence/entity');

  try {
    const files = readdirSync(entitiesDir)
      .filter(f => f.endsWith('.ts') && statSync(path.join(entitiesDir, f)).isFile());

    const classNames: string[] = [];

    for (const file of files) {
      const content = readFileSync(path.join(entitiesDir, file), 'utf-8');
      // Busca clases exportadas: export class Nombre { ... }
      const matches = [...content.matchAll(/export\s+class\s+(\w+)/g)];
      for (const match of matches) {
        classNames.push(match[1]);
      }
    }

    return NextResponse.json({ entities: classNames });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 