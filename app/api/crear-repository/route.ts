import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const repositoryTemplate = `import {Injectable} from "@nestjs/common";
import {GenericRepository} from "./generic.repository";
import {IRepository} from "../../shared/interface";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository } from "typeorm";
import { $nameEntity } from "../entity";

@Injectable()
export class $nameRepository extends GenericRepository<$nameEntity> implements IRepository<$nameEntity>{
    constructor( @InjectRepository($nameEntity)
                 private $paramRepository: Repository<$nameEntity>){
        super($paramRepository,[$relations]);
    }

}`;

export async function POST(req: NextRequest) {
    try {
        const { entityName, basePath, relations = [] } = await req.json();

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

        const repositoryDir = path.join(basePath, 'src/persistence/repository');
        if (!existsSync(repositoryDir)) {
            mkdirSync(repositoryDir, { recursive: true });
        }

        const nombreSinEntity = eliminarSufijo(entityName, 'Entity');
        const nombre = nombreSinEntity;
        const nombreLower = aInicialMinuscula(nombre);
        const repositoryClassName = nombre + 'Repository';
        const fileName = `${formatearNombre(nombre, '-')}.repository.ts`;
        const filePath = path.join(repositoryDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({ 
                error: `El repository ${repositoryClassName} ya existe` 
            }, { status: 409 });
        }

        // Leer la entidad para obtener las relaciones
        const entityPath = path.join(basePath, `src/persistence/entity/${formatearNombre(nombreSinEntity, '-')}.entity.ts`);
        let relaciones: string[] = [];
        
        if (existsSync(entityPath)) {
            const entityContent = readFileSync(entityPath, 'utf-8');
            // Extraer nombres de relaciones (OneToOne, OneToMany, ManyToOne, ManyToMany)
            const relationMatches = entityContent.match(/@(OneToOne|OneToMany|ManyToOne|ManyToMany)\(\(\) => (\w+)/g);
            if (relationMatches) {
                relaciones = relationMatches.map(match => {
                    const nameMatch = match.match(/@(OneToOne|OneToMany|ManyToOne|ManyToMany)\(\(\) => (\w+)/);
                    return nameMatch ? `'${nameMatch[2].toLowerCase()}'` : null;
                }).filter(Boolean) as string[];
            }
        }

        // Preparar template
        let template = repositoryTemplate;
        template = template.replace(/\$nameEntity/g, entityName);
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$param/g, nombreLower);
        template = template.replace(/\$relations/g, relaciones.length > 0 ? relaciones.join(', ') : '');

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts
        const indexPath = path.join(repositoryDir, 'index.ts');
        const exportStatement = `export {${repositoryClassName}} from './${formatearNombre(nombre, '-')}.repository';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export {${repositoryClassName}}`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // Actualizar persistence.module.ts
        const modulePath = path.join(basePath, 'src/persistence/persistence.module.ts');
        if (existsSync(modulePath)) {
            let moduleContent = readFileSync(modulePath, 'utf-8');
            
            // Agregar import del repository si no existe
            const repositoryImport = `import {${repositoryClassName}} from './repository/${formatearNombre(nombre, '-')}.repository';`;
            if (!moduleContent.includes(repositoryImport)) {
                // Insertar después del último import
                const lastImportIndex = moduleContent.lastIndexOf('import ');
                const lastImportEnd = moduleContent.indexOf('\n', lastImportIndex) + 1;
                moduleContent = moduleContent.slice(0, lastImportEnd) + repositoryImport + '\n' + moduleContent.slice(lastImportEnd);
            }

            // Agregar al array de providers
            if (!moduleContent.includes(repositoryClassName)) {
                const providerArrayMatch = moduleContent.match(/providers:\s*\[([^\]]*)\]/);
                if (providerArrayMatch) {
                    const currentArray = providerArrayMatch[1];
                    const newArray = currentArray ? `${currentArray.trim()}, ${repositoryClassName}` : `${repositoryClassName}`;
                    moduleContent = moduleContent.replace(providerArrayMatch[0], `providers: [${newArray}]`);
                }
            }
            
            // Agregar al array de exports
            if (!moduleContent.includes(`${repositoryClassName}`)) {
                const exportArrayMatch = moduleContent.match(/exports:\s*\[([^\]]*)\]/);
                if (exportArrayMatch) {
                    const currentArray = exportArrayMatch[1];
                    const newArray = currentArray ? `${currentArray.trim()}, ${repositoryClassName}` : `${repositoryClassName}`;
                    moduleContent = moduleContent.replace(exportArrayMatch[0], `exports: [${newArray}]`);
                }
            }
            
            writeFileSync(modulePath, moduleContent);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Repository ${repositoryClassName} creado exitosamente`,
            filePath: filePath
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el repository: ${message}` 
        }, { status: 500 });
    }
}
