import { NextResponse } from 'next/server';
import { CrearServiceParams } from '@/generadores/tipos';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';
import { registrarImport, registrarEnArray, combinarRegistros } from '@/utilities/registro-dinamico';
import { formatearCodigo } from '@/utilities/formatear-codigo';

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

export async function crearService(params: CrearServiceParams): Promise<NextResponse> {
    try {
        const { entityName, basePath, traza = true } = params;

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

        // Escribir archivo (F9-m1: el artefacto pasa prettier, igual que el modelo)
        writeFileSync(filePath, await formatearCodigo(template, fileName));

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
        // F8-M1: registrar slice con parser TS (utilities/registro-dinamico) — splice
        // mínimo sobre el AST, no depende del formato prettier on-disk, idempotente.
        const coreServicePath = path.join(basePath, 'src/core/core.service.ts');
        const registroCore = combinarRegistros(
            'core.service.ts',
            registrarImport(coreServicePath, './service', [serviceClassName]),
            registrarEnArray(coreServicePath, 'providers', serviceClassName),
        );
        const avisosRegistro: string[] = registroCore.ok ? [] : [registroCore.motivo ?? 'registro en core.service.ts fallido'];

        return NextResponse.json({
            success: true,
            message: `Service ${serviceClassName} creado exitosamente`,
            filePath: filePath,
            avisos: avisosRegistro,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el service: ${message}` 
        }, { status: 500 });
    }
}
