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
            const attributeMatches = entityContent.match(/@Column\([^)]*\)\s*\n\s*(\w+)(\??):/g);
            if (attributeMatches) {
                atributos = attributeMatches.map(match => {
                    const nameMatch = match.match(/@Column\([^)]*\)\s*\n\s*(\w+)(\??):/);
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
        const parametrosEntityToDto = atributos.map(attr => `${nombreLower}Entity.${attr}`).join(', ');
        const attrNameEntity = `${nombreLower}Entity`;

        // Preparar template
        let template = mapperTemplate;
        template = template.replace(/\$nameEntity/g, entityName);
        template = template.replace(/\$nameDto/g, nombre + 'Dto');
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$parametrosDtoToEntity/g, parametrosDtoToEntity);
        template = template.replace(/\$analisisDtoToUpdateEntity/g, analisisDtoToUpdateEntity);
        template = template.replace(/\$parametrosEntityToDto/g, parametrosEntityToDto);
        template = template.replace(/\$attrNameEntity/g, attrNameEntity);

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts
        const indexPath = path.join(mapperDir, 'index.ts');
        const exportStatement = `export {${mapperClassName}} from './${formatearNombre(nombre, '-')}.mapper';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export {${mapperClassName}}`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
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
