import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import path from 'path';

// Función para convertir nombre de entidad a nombre de archivo kebab-case
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/Entity$/, '')
    .toLowerCase();
}

// Función para detectar si una entidad es un nomenclador
function esNomenclador(content: string, className: string): boolean {
  // Ignorar clases abstractas o base
  if (className === 'NomencladorEntity' || className === 'BaseEntity') {
    return false;
  }

  // Verificar si extiende de NomencladorEntity
  if (content.includes('extends NomencladorEntity') || content.includes('extends BaseNomenclador')) {
    return true;
  }

  // Verificar si tiene los campos típicos de nomenclador
  const tieneCodigo = /@Column.*\n.*\bcodigo\b/m.test(content) || /codigo\??:\s*string/.test(content);
  const tieneNombre = /@Column.*\n.*\bnombre\b/m.test(content) || /nombre\??:\s*string/.test(content);
  const tieneDescripcion = /@Column.*\n.*\bdescripcion\b/m.test(content) || /descripcion\??:\s*string/.test(content);
  
  // Si tiene código, nombre y descripción, es probablemente un nomenclador
  if (tieneCodigo && tieneNombre && tieneDescripcion) {
    return true;
  }

  // Verificar si tiene solo campos básicos (sin relaciones complejas)
  const tieneRelaciones = /@(OneToMany|ManyToOne|ManyToMany|OneToOne)\b/.test(content);
  const tieneCamposBasicos = (content.match(/@Column\b/g) || []).length;
  
  // Si tiene pocos campos y no tiene relaciones complejas, podría ser nomenclador
  if (tieneCamposBasicos <= 5 && !tieneRelaciones && tieneCodigo && tieneNombre) {
    return true;
  }

  return false;
}

// Función para verificar si una entidad ya tiene CRUD creado
function tieneCrudCreado(basePath: string, className: string): boolean {
  const kebabName = toKebabCase(className);
  
  // Verificar si existe el controller (indicador principal de CRUD completo)
  const controllerPath = path.join(basePath, 'src/api/controller', `${kebabName}.controller.ts`);
  if (existsSync(controllerPath)) {
    return true;
  }

  // También verificar si existe el service
  const servicePath = path.join(basePath, 'src/core/service', `${kebabName}.service.ts`);
  if (existsSync(servicePath)) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  const { basePath, filtrarSinCrud = false, excluirNomencladores = false } = await req.json();
  const entitiesDir = path.join(basePath, 'src/persistence/entity');

  try {
    // Verificar si el directorio existe
    if (!existsSync(entitiesDir)) {
      return NextResponse.json({ entities: [] });
    }

    const files = readdirSync(entitiesDir)
      .filter(f => f.endsWith('.ts') && statSync(path.join(entitiesDir, f)).isFile());

    const entidadesValidas: string[] = [];

    for (const file of files) {
      const filePath = path.join(entitiesDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Busca clases exportadas: export class Nombre { ... }
      const matches = [...content.matchAll(/export\s+class\s+(\w+)/g)];
      
      for (const match of matches) {
        const className = match[1];
        
        // Ignorar clases abstractas o de utilidad
        if (className === 'BaseEntity' || className === 'NomencladorEntity' || 
            className.startsWith('Abstract') || className.endsWith('Interface')) {
          continue;
        }

        // Si se solicita excluir nomencladores
        if (excluirNomencladores && esNomenclador(content, className)) {
          continue;
        }

        // Si se solicita filtrar solo entidades sin CRUD
        if (filtrarSinCrud && tieneCrudCreado(basePath, className)) {
          continue;
        }

        entidadesValidas.push(className);
      }
    }

    return NextResponse.json({ entities: entidadesValidas });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}