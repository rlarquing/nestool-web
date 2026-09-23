import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const serviceTemplate = `import {Injectable} from '@nestjs/common';
import {$nameEntity} from '../../persistence/entity';
import {$nameRepository} from "../../persistence/repository";
import {$nameMapper} from "../mapper";
import {LogHistoryService} from "./log-history.service";
import {GenericService} from "./generic.service";
import { ConfigService } from '@nestjs/config';

@Injectable()
export class $nameService extends GenericService<$nameEntity> {
    constructor(
        protected configService: ConfigService,
        protected $paramRepository: $nameRepository,
        protected $paramMapper: $nameMapper,
        protected logHistoryService: LogHistoryService,
    ) {
        super(configService, $paramRepository, $paramMapper, logHistoryService, $traza);
    }
}`;

export async function POST(req: NextRequest) {
    try {
        const { entityName, basePath, traza = true } = await req.json();

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

        const serviceDir = path.join(basePath, 'src/core/service');
        if (!existsSync(serviceDir)) {
            mkdirSync(serviceDir, { recursive: true });
        }

        const nombreSinEntity = eliminarSufijo(entityName, 'Entity');
        const nombre = nombreSinEntity;
        const nombreLower = aInicialMinuscula(nombre);
        // La clase real siempre termina en "Entity" (así la crea crear-entidad)
        const entityClassName = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const serviceClassName = nombre + 'Service';
        const fileName = `${formatearNombre(nombre, '-')}.service.ts`;
        const filePath = path.join(serviceDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({ 
                error: `El service ${serviceClassName} ya existe` 
            }, { status: 409 });
        }

        // Preparar template
        let template = serviceTemplate;
        template = template.replace(/\$nameEntity/g, entityClassName);
        template = template.replace(/\$nameRepository/g, nombre + 'Repository');
        template = template.replace(/\$nameMapper/g, nombre + 'Mapper');
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$param/g, nombreLower);
        template = template.replace(/\$traza/g, String(traza));

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts (formato con espacios, igual al de la api)
        const indexPath = path.join(serviceDir, 'index.ts');
        const exportStatement = `export { ${serviceClassName} } from './${formatearNombre(nombre, '-')}.service';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export { ${serviceClassName} }`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // --- ACTUALIZAR core.service.ts (registro dinámico de providers de core) ---
        // core.module.ts consume `export const providers = [...]` desde core.service.ts;
        // el fichero real declara el array con "=" (no es un objeto Module).
        const coreServicePath = path.join(basePath, 'src/core/core.service.ts');
        if (existsSync(coreServicePath)) {
            let coreContent = readFileSync(coreServicePath, 'utf-8');

            // 1. Agregar la clase al import existente desde './service' si no está
            const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/service['"];?/;
            if (importRegex.test(coreContent)) {
                coreContent = coreContent.replace(importRegex, (match, imports) => {
                    let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(serviceClassName)) importList.push(serviceClassName);
                    importList = Array.from(new Set(importList));
                    return `import { ${importList.join(', ')} } from './service';`;
                });
            } else {
                coreContent = `import { ${serviceClassName} } from './service';\n` + coreContent;
            }

            // 2. Agregar al array 'providers' si no está
            const providersArrayRegex = /export\s+const\s+providers\s*=\s*\[([^\]]*)\]/;
            if (providersArrayRegex.test(coreContent)) {
                coreContent = coreContent.replace(providersArrayRegex, (match, items) => {
                    let itemList = items.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!itemList.includes(serviceClassName)) itemList.push(serviceClassName);
                    itemList = Array.from(new Set(itemList));
                    return `export const providers = [${itemList.join(', ')}]`;
                });
            }

            writeFileSync(coreServicePath, coreContent);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Service ${serviceClassName} creado exitosamente`,
            filePath: filePath
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el service: ${message}` 
        }, { status: 500 });
    }
}
