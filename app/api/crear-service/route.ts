import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const serviceTemplate = `import {Injectable} from '@nestjs/common';
import {$nameEntity} from '../../persistence/entity';
import {$nameRepository} from "../../persistence/repository";
import {$nameMapper} from "../mapper";
import {TrazaService} from "./traza.service";
import {GenericService} from "./generic.service";
import { ConfigService } from '@nestjs/config';

@Injectable()
export class $nameService extends GenericService<$nameEntity> {
    constructor(
        protected configService: ConfigService,
        protected $paramRepository: $nameRepository,
        protected $paramMapper: $nameMapper,
        protected trazaService: TrazaService,
    ) {
        super(configService, $paramRepository, $paramMapper, trazaService, $traza);
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
        template = template.replace(/\$nameEntity/g, entityName);
        template = template.replace(/\$nameRepository/g, nombre + 'Repository');
        template = template.replace(/\$nameMapper/g, nombre + 'Mapper');
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$param/g, nombreLower);
        template = template.replace(/\$traza/g, String(traza));

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts
        const indexPath = path.join(serviceDir, 'index.ts');
        const exportStatement = `export {${serviceClassName}} from './${formatearNombre(nombre, '-')}.service';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export {${serviceClassName}}`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // Actualizar core.service.ts
        const coreServicePath = path.join(basePath, 'src/core/core.service.ts');
        if (existsSync(coreServicePath)) {
            let coreContent = readFileSync(coreServicePath, 'utf-8');
            
            // Agregar import del service si no existe
            const serviceImport = `import {${serviceClassName}} from './service/${formatearNombre(nombre, '-')}.service';`;
            if (!coreContent.includes(serviceImport)) {
                // Insertar después del último import
                const lastImportIndex = coreContent.lastIndexOf('import ');
                const lastImportEnd = coreContent.indexOf('\n', lastImportIndex) + 1;
                coreContent = coreContent.slice(0, lastImportEnd) + serviceImport + '\n' + coreContent.slice(lastImportEnd);
            }

            // Agregar al array de providers
            if (!coreContent.includes(serviceClassName)) {
                const providerArrayMatch = coreContent.match(/providers:\s*\[([^\]]*)\]/);
                if (providerArrayMatch) {
                    const currentArray = providerArrayMatch[1];
                    const newArray = currentArray ? `${currentArray.trim()}, ${serviceClassName}` : `${serviceClassName}`;
                    coreContent = coreContent.replace(providerArrayMatch[0], `providers: [${newArray}]`);
                }
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
