import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const mapperTemplate = `import {Injectable} from '@nestjs/common';
import {$nameEntity} from "../../persistence/entity";
import {Create$nameDto, Read$nameDto, Update$nameDto} from "../../shared/dto";

@Injectable()
export class $nameMapper {

    async dtoToEntity(create$nameDto: Create$nameDto): Promise<$nameEntity> {
        return new $nameEntity($parametrosDtoToEntity);
    }

    async dtoToUpdateEntity(update$nameDto: Update$nameDto, update$nameEntity: $nameEntity): Promise<$nameEntity> {
        $analisisDtoToUpdateEntity
        return update$nameEntity;
    }

    async entityToDto($attrNameEntity: $nameEntity): Promise<Read$nameDto> {
        const dtoToString: string = $attrNameEntity.toString();
        return new Read$nameDto($parametrosEntityToDto);
    }
}`;

export async function POST(req: NextRequest) {
    try {
        const { entityName, basePath } = await req.json();

        if (!entityName || !basePath) {
            return NextResponse.json({ 
                error: 'entityName y basePath son requeridos' 
            }, { status: 400 });
        }

        if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
            return NextResponse.json({ 
                error: 'El nombre de la entidad debe empezar con mayúscula' 
            }, { status: 400 });
        }

        const mapperDir = path.join(basePath, 'src/core/mapper');
        if (!existsSync(mapperDir)) {
            mkdirSync(mapperDir, { recursive: true });
        }

        const nombreSinEntity = eliminarSufijo(entityName, 'Entity');
        const nombre = nombreSinEntity;
        const nombreLower = aInicialMinuscula(nombre);
        // La clase real siempre termina en "Entity" (así la crea crear-entidad)
        const entityClassName = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const mapperClassName = nombre + 'Mapper';
        const fileName = `${formatearNombre(nombre, '-')}.mapper.ts`;
        const filePath = path.join(mapperDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({ 
                error: `El mapper ${mapperClassName} ya existe` 
            }, { status: 409 });
        }

        // Leer la entidad para obtener los atributos
        const entityPath = path.join(basePath, `src/persistence/entity/${formatearNombre(nombreSinEntity, '-')}.entity.ts`);
        let atributos: string[] = [];
        
        if (existsSync(entityPath)) {
            const entityContent = readFileSync(entityPath, 'utf-8');
            // Extraer nombres de atributos (solo los básicos, no relaciones)
            const attributeMatches = entityContent.match(/@Column\([^)]*\)\s*\n\s*(\w+)([!?])?:/g);
            if (attributeMatches) {
                atributos = attributeMatches.map(match => {
                    const nameMatch = match.match(/@Column\([^)]*\)\s*\n\s*(\w+)([!?])?:/);
                    return nameMatch ? nameMatch[1] : null;
                }).filter(Boolean) as string[];
            }
        }

        // Si no encontramos atributos, usar algunos por defecto
        if (atributos.length === 0) {
            atributos = ["nombre", "descripcion"];
        }

        // Preparar parámetros para el template
        const parametrosDtoToEntity = atributos.map(attr => `create${nombre}Dto.${attr}`).join(', ');
        const analisisDtoToUpdateEntity = atributos.map(attr => 
            `        if (update${nombre}Dto.${attr} !== undefined) update${nombre}Entity.${attr} = update${nombre}Dto.${attr};`
        ).join('\n');
        // El Read DTO se construye con (dtoToString, id, ...atributos)
        const parametrosEntityToDto = [`${nombreLower}Entity.toString()`, `${nombreLower}Entity.id`, ...atributos.map(attr => `${nombreLower}Entity.${attr}`)].join(', ');
        const attrNameEntity = `${nombreLower}Entity`;

        // Preparar template
        let template = mapperTemplate;
        template = template.replace(/\$nameEntity/g, entityClassName);
        template = template.replace(/\$nameDto/g, nombre + 'Dto');
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$parametrosDtoToEntity/g, parametrosDtoToEntity);
        template = template.replace(/\$analisisDtoToUpdateEntity/g, analisisDtoToUpdateEntity);
        template = template.replace(/\$parametrosEntityToDto/g, parametrosEntityToDto);
        template = template.replace(/\$attrNameEntity/g, attrNameEntity);

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts (formato con espacios, igual al de la api)
        const indexPath = path.join(mapperDir, 'index.ts');
        const exportStatement = `export { ${mapperClassName} } from './${formatearNombre(nombre, '-')}.mapper';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export { ${mapperClassName} }`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // --- ACTUALIZAR core.service.ts (la api registra PARES service+mapper en providers) ---
        // Si el mapper no se registra, el service no puede resolverlo (DI failure).
        const coreServicePath = path.join(basePath, 'src/core/core.service.ts');
        if (existsSync(coreServicePath)) {
            let coreContent = readFileSync(coreServicePath, 'utf-8');

            // 1. Agregar la clase al import existente desde './mapper' si no está
            const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/mapper['"];?/;
            if (importRegex.test(coreContent)) {
                coreContent = coreContent.replace(importRegex, (match, imports) => {
                    let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(mapperClassName)) importList.push(mapperClassName);
                    importList = Array.from(new Set(importList));
                    return `import { ${importList.join(', ')} } from './mapper';`;
                });
            } else {
                coreContent = `import { ${mapperClassName} } from './mapper';\n` + coreContent;
            }

            // 2. Agregar al array 'providers' si no está
            const providersArrayRegex = /export\s+const\s+providers\s*=\s*\[([^\]]*)\]/;
            if (providersArrayRegex.test(coreContent)) {
                coreContent = coreContent.replace(providersArrayRegex, (match, items) => {
                    let itemList = items.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!itemList.includes(mapperClassName)) itemList.push(mapperClassName);
                    itemList = Array.from(new Set(itemList));
                    return `export const providers = [${itemList.join(', ')}]`;
                });
            }

            writeFileSync(coreServicePath, coreContent);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Mapper ${mapperClassName} creado exitosamente`,
            filePath: filePath
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el mapper: ${message}` 
        }, { status: 500 });
    }
}
