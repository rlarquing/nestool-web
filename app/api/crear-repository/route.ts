import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';
import { cargarEntity, EntityInfo, RelacionEntity } from '@/utilities/entity-parser';
import { repositorySimpleTemplate, repositoryRelacionalTemplate } from '@/template/repository.template';

// Fase 3 (F7-C3 / F7-M1): repositorios fieles al modelo menu-traduccion.repository.ts.
//  - Parseo robusto de relaciones con utilities/entity-parser (nombres de propiedad
//    EXACTOS, soporta decoradores multi-línea).
//  - Si la entity tiene relaciones unitarias (ManyToOne/OneToOne), el repository
//    inyecta además los repositories de las entidades relacionadas y expone los
//    helpers findXById (filtro activo: true) que el mapper usa para el 404 i18n.
//  - Las relaciones a la PROPIA entidad (autorrelación) no generan inyección
//    auxiliar: el repository propio ya consulta esa tabla (modelo MenuRepository).
//  - El registro sigue siendo dinámico: array `export const repository` de
//    persistence.service.ts (fase 1, F7-C1/C2).

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
        const kebab = formatearNombre(nombre, '-');
        const fileName = `${kebab}.repository.ts`;
        const filePath = path.join(repositoryDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({
                error: `El repository ${repositoryClassName} ya existe`
            }, { status: 409 });
        }

        // Parseo robusto de la entity (422 si no existe o no parsea)
        const entityPath = path.join(basePath, `src/persistence/entity/${kebab}.entity.ts`);
        let info: EntityInfo;
        try {
            info = cargarEntity(entityPath, entityClassName);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return NextResponse.json({ error: message }, { status: 422 });
        }

        const unitarias = info.relaciones.filter((r) => r.tipoRelacion === 'ManyToOne' || r.tipoRelacion === 'OneToOne');
        // Relaciones a la propia entidad: sin repos auxiliares (autorrelación)
        const auxiliares = unitarias.filter((r) => r.destino && r.destino !== entityClassName);
        if (unitarias.some((r) => !r.destino)) {
            return NextResponse.json({
                error: `La entity ${entityClassName} tiene relaciones unitarias sin entidad destino detectable; no se puede generar el repository relacional.`
            }, { status: 422 });
        }

        // Nombres de TODAS las relaciones (en orden de declaración) para super(repo, [...])
        const relationsArgs = info.relaciones.map((r) => `'${r.nombre}'`).join(', ');

        let template: string;
        if (auxiliares.length > 0) {
            // --- Repositorio relacional (F7-C3) ---
            // Una inyección + un helper POR ENTIDAD RELACIONADA (deduplicados)
            const entidadesAux: string[] = [];
            const inyecciones: string[] = [];
            const helpers: string[] = [];
            const campoPorEntidad = new Map<string, string>();
            for (const r of auxiliares) {
                if (!campoPorEntidad.has(r.destino)) {
                    const campo = `${aInicialMinuscula(eliminarSufijo(r.destino, 'Entity'))}Repository`;
                    campoPorEntidad.set(r.destino, campo);
                    entidadesAux.push(r.destino);
                    inyecciones.push(`        @InjectRepository(${r.destino})\n        private ${campo}: Repository<${r.destino}>,`);
                    helpers.push([
                        ``,
                        `    async find${eliminarSufijo(r.destino, 'Entity')}ById(id: number): Promise<${r.destino} | null> {`,
                        `        return this.${campo}.findOne({ where: { id, activo: true } });`,
                        `    }`,
                    ].join('\n'));
                }
            }
            const entidadesImport = Array.from(new Set([entityClassName, ...entidadesAux])).join(', ');

            template = repositoryRelacionalTemplate
                .replace(/\$entidadesImport/g, entidadesImport)
                .replace(/\$inyeccionesAuxiliares/g, inyecciones.join('\n'))
                .replace(/\$relations/g, relationsArgs)
                .replace(/\$helpers/g, helpers.join('\n'))
                .replace(/\$param/g, nombreLower)
                .replace(/\$name/g, nombre);
        } else {
            // --- Repositorio simple ---
            // El 2º argumento de super() (relations) es opcional: se omite si no hay relaciones
            const superArgs = info.relaciones.length > 0 ? `, [${relationsArgs}]` : '';
            template = repositorySimpleTemplate
                .replace(/\$superArgs/g, superArgs)
                .replace(/\$param/g, nombreLower)
                .replace(/\$name/g, nombre);
        }

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts (formato con espacios, igual al de la api)
        const indexPath = path.join(repositoryDir, 'index.ts');
        const exportStatement = `export { ${repositoryClassName} } from './${kebab}.repository';\n`;

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
