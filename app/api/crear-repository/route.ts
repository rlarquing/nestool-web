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

// Extrae los nombres de las propiedades de relacion tal y como estan declaradas
// en la entidad (soporta decoradores en multiples lineas, @JoinColumn, etc.).
// El nombre de la propiedad debe coincidir EXACTAMENTE con el atributo de la
// entidad para que TypeORM resuelva el join.
function extraerNombresRelaciones(entityContent: string): string[] {
    const relaciones: string[] = [];
    const lineas = entityContent.split('\n');
    const regexRelacion = /@(OneToOne|OneToMany|ManyToOne|ManyToMany)\(/;
    const regexPropiedad = /^\s*(\w+)(\?)?(!)?:\s*[\w\[\]]+.*;?\s*$/;

    for (let i = 0; i < lineas.length; i++) {
        if (regexRelacion.test(lineas[i])) {
            // Buscar hacia adelante la primera declaracion de propiedad
            for (let j = i + 1; j < lineas.length; j++) {
                const linea = lineas[j].trim();
                if (regexPropiedad.test(linea)) {
                    const match = linea.match(regexPropiedad);
                    if (match && !relaciones.includes(`'${match[1]}'`)) {
                        relaciones.push(`'${match[1]}'`);
                    }
                    break;
                }
                // Si aparece otro decorador de relacion seguido, seguir buscando
                // (JoinTable/JoinColumn no cortan la busqueda)
                if (/^\s*@(?!OneToOne|OneToMany|ManyToOne|ManyToMany|Join)/.test(lineas[j])) {
                    break;
                }
            }
        }
    }
    return relaciones;
}

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
        // La clase real siempre termina en "Entity" (así la crea crear-entidad)
        const entityClassName = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const repositoryClassName = nombre + 'Repository';
        const fileName = `${formatearNombre(nombre, '-')}.repository.ts`;
        const filePath = path.join(repositoryDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({ 
                error: `El repository ${repositoryClassName} ya existe` 
            }, { status: 409 });
        }

        // Leer la entidad para obtener las relaciones (por el NOMBRE de la propiedad declarada)
        const entityPath = path.join(basePath, `src/persistence/entity/${formatearNombre(nombreSinEntity, '-')}.entity.ts`);
        let relaciones: string[] = [];

        if (existsSync(entityPath)) {
            const entityContent = readFileSync(entityPath, 'utf-8');
            relaciones = extraerNombresRelaciones(entityContent);
        }

        // Preparar template
        let template = repositoryTemplate;
        template = template.replace(/\$nameEntity/g, entityClassName);
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
