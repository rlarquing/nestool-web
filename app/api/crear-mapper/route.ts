import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula, ordenRequeridoPrimero } from '@/utilities/entity-utils';
import { ordenSegunConstructor } from '@/utilities/entidad-sync';
import { cargarEntity, EntityInfo, RelacionEntity } from '@/utilities/entity-parser';
import { mapperSimpleTemplate, mapperRelacionalTemplate } from '@/template/mapper.template';

// Fase 3 (F6): mapper fiel al modelo menu-traduccion.mapper.ts de la api-base.
//  - F6-C3: parseo robusto de la entity (utilities/entity-parser); 422 si no existe
//    o no parsea; JAMÁS se fabrican atributos de respaldo.
//  - F6-C1: entidades con relaciones unitarias (ManyToOne/OneToOne) usan la rama
//    relacional: inyecta su repository, resuelve con findXById, 404 con i18n y
//    mapea ids (entity.menu?.id) en el Read.
//  - F6-C2: los templates viven en template/mapper.template.ts (fuente única).

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
        const kebab = formatearNombre(nombre, '-');
        const fileName = `${kebab}.mapper.ts`;
        const filePath = path.join(mapperDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({
                error: `El mapper ${mapperClassName} ya existe`
            }, { status: 409 });
        }

        // F6-C3: parseo robusto; sin entity no hay generación (422, no un import roto)
        const entityPath = path.join(basePath, `src/persistence/entity/${kebab}.entity.ts`);
        let info: EntityInfo;
        try {
            info = cargarEntity(entityPath, entityClassName);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return NextResponse.json({ error: message }, { status: 422 });
        }

        const unitarias = info.relaciones.filter((r) => r.tipoRelacion === 'ManyToOne' || r.tipoRelacion === 'OneToOne');
        const conDestino = unitarias.filter((r) => r.destino);
        if (unitarias.length !== conDestino.length) {
            return NextResponse.json({
                error: `La entity ${entityClassName} tiene relaciones unitarias sin entidad destino detectable; no se puede generar el mapper relacional.`
            }, { status: 422 });
        }

        const avisos: string[] = [];
        const repositoryFilePath = path.join(basePath, `src/persistence/repository/${kebab}.repository.ts`);
        if (conDestino.length > 0 && !existsSync(repositoryFilePath)) {
            avisos.push(`El repository ${nombre}Repository aún no existe: el mapper lo importa pero la API no compilará hasta crearlo (función "Crear repository").`);
        }

        // Atributos que aparecen en el ReadDto (mismo orden que crear-dto: se omite OneToMany)
        const attrsRead = info.atributos.filter((a) => a.tipo === 'columna' || (a.tipo === 'relacion' && a.tipoRelacion !== 'OneToMany'));
        const singularDe = (destino: string) => aInicialMinuscula(eliminarSufijo(destino, 'Entity'));

        // Mapeo de un atributo para la posición correspondiente del ReadDto
        const paramReadDe = (a: (typeof attrsRead)[number]): string => {
            if (a.tipo === 'columna') return `${nombreLower}Entity.${a.nombre}`;
            if (a.tipoRelacion === 'ManyToMany' || a.tipoRelacion === 'OneToMany') {
                return `${nombreLower}Entity.${a.nombre}?.map((${singularDe(a.destino)}) => ${singularDe(a.destino)}.id) ?? []`;
            }
            return `${nombreLower}Entity.${a.nombre}?.id`;
        };

        let template: string;
        let parametrosDtoToEntity: string;

        if (conDestino.length > 0) {
            // ---- Rama relacional (F6-C1) ----
            // Resoluciones (create y update) con findXById + 404 i18n
            const resolver = (dtoVar: 'create' | 'update'): string => {
                const bloques: string[] = [];
                for (const r of conDestino) {
                    const dtoField = `${dtoVar}${nombre}Dto.${r.nombre}`;
                    const helper = `find${eliminarSufijo(r.destino, 'Entity')}ById`;
                    const i18nKey = `${kebab}.${r.nombre.toUpperCase()}_NOT_FOUND`;
                    const nombreBonito = eliminarSufijo(r.destino, 'Entity');
                    const lineaMsg = '                        `' + nombreBonito + ' con id ${' + dtoField + '} no encontrado`,';
                    if (r.opcional) {
                        bloques.push([
                            `        let ${r.nombre}: ${r.destino} | undefined;`,
                            `        if (${dtoField} !== undefined) {`,
                            `            ${r.nombre} = await this.${nombreLower}Repository.${helper}(${dtoField});`,
                            `            if (!${r.nombre})`,
                            `                throw new NotFoundException(`,
                            `                    traducir(`,
                            `                        '${i18nKey}',`,
                            lineaMsg,
                            `                        { id: ${dtoField} },`,
                            `                    ),`,
                            `                );`,
                            `        }`,
                        ].join('\n'));
                    } else {
                        bloques.push([
                            `        const ${r.nombre} = await this.${nombreLower}Repository.${helper}(${dtoField});`,
                            `        if (!${r.nombre})`,
                            `            throw new NotFoundException(`,
                            `                traducir(`,
                            `                    '${i18nKey}',`,
                            `                    ` + '`' + nombreBonito + ' con id ${' + dtoField + '} no encontrado`,',
                            `                    { id: ${dtoField} },`,
                            `                ),`,
                            `            );`,
                        ].join('\n'));
                    }
                }
                return bloques.join('\n\n');
            };

            const resolucionCreate = resolver('create');
            const resolucionUpdate = resolver('update');

            // Asignaciones del update: relaciones resueltas + columnas
            const asignaciones: string[] = [];
            for (const r of conDestino) {
                if (r.opcional) {
                    asignaciones.push(`        if (${r.nombre} !== undefined) update${nombre}Entity.${r.nombre} = ${r.nombre};`);
                } else {
                    asignaciones.push(`        update${nombre}Entity.${r.nombre} = ${r.nombre};`);
                }
            }
            for (const c of info.columnas) {
                if (c.opcional) {
                    asignaciones.push(`        if (update${nombre}Dto.${c.nombre} !== undefined) update${nombre}Entity.${c.nombre} = update${nombre}Dto.${c.nombre};`);
                } else {
                    asignaciones.push(`        update${nombre}Entity.${c.nombre} = update${nombre}Dto.${c.nombre};`);
                }
            }

            // Parámetros del constructor de la entity: relaciones unitarias + columnas.
            // Fuente de verdad del orden posicional: el CONSTRUCTOR REAL de la entity
            // (F2: tras una edición el orden de declaración puede no coincidir con el
            // constructor). Fallback: el orden canónico requeridos-primero.
            const atributosConstructor = info.atributos.filter(
                (a) => a.tipo === 'columna' || (a.tipo === 'relacion' && (a.tipoRelacion === 'ManyToOne' || a.tipoRelacion === 'OneToOne'))
            );
            const contenidoEntity = readFileSync(entityPath, 'utf-8');
            const constructorOrdenado = ordenSegunConstructor(contenidoEntity, atributosConstructor)
                ?? ordenRequeridoPrimero(atributosConstructor, (a) => !a.opcional);
            const parametrosNew = constructorOrdenado.map((a) =>
                a.tipo === 'columna' ? `create${nombre}Dto.${a.nombre}` : a.nombre
            );
            parametrosDtoToEntity = parametrosNew.join(', ');

            // Read: (dtoToString, id, ...atributos en orden de declaración sin OneToMany)
            const parametrosEntityToDto = ['dtoToString', `${nombreLower}Entity.id`, ...attrsRead.map(paramReadDe)].join(', ');

            const entidadesImport = Array.from(new Set([entityClassName, ...conDestino.map((r) => r.destino)])).join(', ');

            template = mapperRelacionalTemplate
                .replace(/\$entidadesImport/g, entidadesImport)
                .replace(/\$resolucionCreate/g, resolucionCreate)
                .replace(/\$resolucionUpdate/g, resolucionUpdate)
                .replace(/\$asignacionesUpdate/g, asignaciones.join('\n'))
                .replace(/\$parametrosDtoToEntity/g, parametrosDtoToEntity)
                .replace(/\$parametrosEntityToDto/g, parametrosEntityToDto)
                .replace(/\$attrNameRepository/g, `${nombreLower}Repository`)
                .replace(/\$attrNameEntity/g, `${nombreLower}Entity`)
                .replace(/\$name/g, nombre);
        } else {
            // ---- Rama simple (F6-M1: síncrona, dtoToString usado) ----
            // Orden posicional desde el constructor real de la entity (F2); fallback canónico.
            const contenidoEntitySimple = readFileSync(entityPath, 'utf-8');
            const columnasOrdenadas = ordenSegunConstructor(contenidoEntitySimple, info.columnas)
                ?? ordenRequeridoPrimero(info.columnas, (c) => !c.opcional);
            parametrosDtoToEntity = columnasOrdenadas.map((c) => `create${nombre}Dto.${c.nombre}`).join(', ');
            const analisisDtoToUpdateEntity = info.columnas.map((c) =>
                c.opcional
                    ? `        if (update${nombre}Dto.${c.nombre} !== undefined) update${nombre}Entity.${c.nombre} = update${nombre}Dto.${c.nombre};`
                    : `        update${nombre}Entity.${c.nombre} = update${nombre}Dto.${c.nombre};`
            ).join('\n');
            const parametrosEntityToDto = ['dtoToString', `${nombreLower}Entity.id`, ...attrsRead.map(paramReadDe)].join(', ');

            template = mapperSimpleTemplate
                .replace(/\$parametrosDtoToEntity/g, parametrosDtoToEntity)
                .replace(/\$analisisDtoToUpdateEntity/g, analisisDtoToUpdateEntity)
                .replace(/\$parametrosEntityToDto/g, parametrosEntityToDto)
                .replace(/\$attrNameEntity/g, `${nombreLower}Entity`)
                .replace(/\$name/g, nombre);
        }

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts (formato con espacios, igual al de la api)
        const indexPath = path.join(mapperDir, 'index.ts');
        const exportStatement = `export { ${mapperClassName} } from './${kebab}.mapper';\n`;

        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export { ${mapperClassName} }`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // --- ACTUALIZAR core.service.ts (la api registra PARES service+mapper en providers) ---
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
            filePath: filePath,
            avisos: avisos,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: `Error al crear el mapper: ${message}`
        }, { status: 500 });
    }
}
