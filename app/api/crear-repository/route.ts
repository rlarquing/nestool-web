import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const repositoryTemplate = `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenericRepository } from './generic.repository';
import { IRepository } from '../../shared/interface';
import { $nameEntity } from '../entity';

@Injectable()
export class $nameRepository extends GenericRepository<$nameEntity> implements IRepository<$nameEntity> {
    constructor(
        @InjectRepository($nameEntity)
        private $paramRepository: Repository<$nameEntity>,
    ) {
        super($paramRepository$superArgs);
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
        // El 2º argumento de super() (relations) es opcional: se omite si no hay relaciones
        const superArgs = relaciones.length > 0 ? `, [${relaciones.join(', ')}]` : '';
        template = template.replace(/\$superArgs/g, superArgs);

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts (formato con espacios, igual al de la api)
        const indexPath = path.join(repositoryDir, 'index.ts');
        const exportStatement = `export { ${repositoryClassName} } from './${formatearNombre(nombre, '-')}.repository';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export { ${repositoryClassName} }`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // --- ACTUALIZAR persistence.service.ts (registro dinámico de repositories) ---
        // persistence.module.ts consume `export const repository = [...]` (forFeature,
        // providers y exports usan ese mismo array). NO se debe parchear
        // persistence.module.ts directamente: el registro vive en persistence.service.ts.
        const servicePath = path.join(basePath, 'src/persistence/persistence.service.ts');
        if (existsSync(servicePath)) {
            let serviceContent = readFileSync(servicePath, 'utf-8');

            // 1. Agregar la clase al import existente desde './repository' si no está
            const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/repository['"];?/;
            if (importRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(importRegex, (match, imports) => {
                    let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(repositoryClassName)) importList.push(repositoryClassName);
                    importList = Array.from(new Set(importList));
                    return `import { ${importList.join(', ')} } from './repository';`;
                });
            } else {
                serviceContent = `import { ${repositoryClassName} } from './repository';\n` + serviceContent;
            }

            // 2. Agregar al array 'repository' si no está
            //    (esto lo registra en providers, exports Y deja la entity disponible en forFeature)
            const repositoryArrayRegex = /export\s+const\s+repository\s*=\s*\[([^\]]*)\]/;
            if (repositoryArrayRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(repositoryArrayRegex, (match, items) => {
                    let itemList = items.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!itemList.includes(repositoryClassName)) itemList.push(repositoryClassName);
                    itemList = Array.from(new Set(itemList));
                    return `export const repository = [${itemList.join(', ')}]`;
                });
            }

            writeFileSync(servicePath, serviceContent);
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
