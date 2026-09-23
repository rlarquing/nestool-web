import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import {
    formatearNombre, eliminarSufijo, generarColumna, generarRelacion, generarRelacionInversa,
    generarToStringBody, aInicialMinuscula, pluralizarEntidad, snakeDe, ordenRequeridoPrimero,
} from '@/utilities/entity-utils';
import { insertarMiembroEnClase, agregarImportAContent, fusionarImportsTypeorm, leerClase } from '@/utilities/entity-edicion';
import { genericEntity } from '@/template/entity.template';

// TypeORM imports que necesita la ENTIDAD DESTINO según la relación directa
// que se le inyecta como inversa.
function typeormImportsInversa(tipoRelacion: string): string[] {
    switch (tipoRelacion) {
        case 'ManyToOne': return ['OneToMany'];
        case 'OneToMany': return ['ManyToOne', 'JoinColumn'];
        case 'OneToOne': return ['OneToOne'];
        case 'ManyToMany': return ['ManyToMany'];
        default: return [];
    }
}

/** Nombre de la propiedad que declara el bloque inverso generado. */
function nombrePropiedadInversa(bloque: string): string | null {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = lineas.length - 1; i >= 0; i--) {
        const match = lineas[i].match(/^([A-Za-z_$][\w$]*)[?!]?:\s*[A-Za-z_$][\w$]*(\[\])?;/);
        if (match) return match[1];
    }
    return null;
}

interface ResultadoInyeccion {
    avisos: string[];
}

/**
 * Inyecta la relación inversa en la entity destino (F1-C1/C4/C5):
 *  - fichero existente: edición quirúrgica con ancla idempotente, sin reescribir nada más;
 *  - fichero inexistente: se crea con el template completo (GenericEntity + schema + orderBy)
 *    y se registra en index.ts y en el registro dinámico de persistence.service.ts (F1-M4).
 */
function inyectarRelacionInversa(
    basePath: string,
    ctx: {
        tipoRelacion: string;
        nombreAtributo: string;
        entidadOrigen: string;
        entidadDestino: string;
        coleccionInversa: string;
        nombreInversa?: string;
        requerido: boolean;
    },
    opciones: { esquema: string },
): ResultadoInyeccion {
    const avisos: string[] = [];
    const entityDir = path.join(basePath, 'src/persistence/entity');
    const kebabDestino = formatearNombre(eliminarSufijo(ctx.entidadDestino, 'Entity'), '-');
    const destinoFilePath = path.join(entityDir, `${kebabDestino}.entity.ts`);
    const bloque = generarRelacionInversa(ctx);
    const ancla = `// [nestool] inversa de ${ctx.entidadOrigen}.${ctx.nombreAtributo}`;

    let destinoContent = leerClase(destinoFilePath, ctx.entidadDestino);
    if (destinoContent === null && existsSync(destinoFilePath)) {
        avisos.push(`Entity ${ctx.entidadDestino} existe pero no se pudo parsear: NO se inyectó la relación inversa (fichero intacto).`);
        return { avisos };
    }

    const esNueva = destinoContent === null;
    if (esNueva) {
        // F1-M4: entidad destino inexistente → template completo, no una clase pelada
        destinoContent = genericEntity
            .replace('$typeormImport', `import { Entity } from 'typeorm';`)
            .replace('$import', '')
            .replace('$index', '')
            .replace('$entidad', formatearNombre(eliminarSufijo(ctx.entidadDestino, 'Entity'), '_'))
            .replace('$schema', opciones.esquema)
            .replace('$nameEntity', ctx.entidadDestino)
            .replace('$atributos', bloque)
            .replace('$parametros', '')
            .replace('$thisAtributos', '')
            .replace('$toStringBody', 'return String(this.id);');
        avisos.push(`Entity ${ctx.entidadDestino} creada automáticamente (con la relación inversa) y registrada.`);
    } else {
        // Idempotencia por ancla (F1-C4)
        if (destinoContent!.includes(ancla)) {
            return { avisos };
        }
        // Colisión de propiedad: no corromper el fichero
        const propiedad = nombrePropiedadInversa(bloque);
        if (propiedad && new RegExp(`\\b${propiedad}\\s*[?!]?:`).test(destinoContent!)) {
            avisos.push(`Entity ${ctx.entidadDestino} ya declara la propiedad "${propiedad}": no se inyectó la inversa duplicada.`);
            return { avisos };
        }
        const insertado = insertarMiembroEnClase(destinoContent!, bloque);
        if (insertado === null) {
            avisos.push(`No se encontró el cuerpo de la clase en ${ctx.entidadDestino}: NO se inyectó la relación inversa.`);
            return { avisos };
        }
        destinoContent = insertado;
    }

    // Imports de typeorm que necesita la inversa + import de la entity origen
    destinoContent = fusionarImportsTypeorm(destinoContent!, typeormImportsInversa(ctx.tipoRelacion));
    const importOrigen = `import { ${ctx.entidadOrigen} } from './${formatearNombre(eliminarSufijo(ctx.entidadOrigen, 'Entity'), '-')}.entity';`;
    if (!destinoContent!.includes(`{ ${ctx.entidadOrigen} }`)) {
        destinoContent = agregarImportAContent(destinoContent!, importOrigen);
    }

    if (!existsSync(entityDir)) {
        mkdirSync(entityDir, { recursive: true });
    }
    writeFileSync(destinoFilePath, destinoContent!);

    if (esNueva) {
        registrarEntidadEnIndex(entityDir, ctx.entidadDestino, kebabDestino);
        registrarEntidadEnPersistence(path.join(basePath, 'src/persistence/persistence.service.ts'), ctx.entidadDestino);
    }
    return { avisos };
}

/** Registra la entity en entity/index.ts (formato con espacios, igual al resto). */
function registrarEntidadEnIndex(entityDir: string, className: string, kebab: string): void {
    const indexPath = path.join(entityDir, 'index.ts');
    const exportStatement = `export { ${className} } from './${kebab}.entity';\n`;
    if (existsSync(indexPath)) {
        const indexContent = readFileSync(indexPath, 'utf-8');
        if (!indexContent.includes(`{ ${className} }`)) {
            writeFileSync(indexPath, indexContent + exportStatement);
        }
    } else {
        writeFileSync(indexPath, exportStatement);
    }
}

/** Registra la entity en el array dinámico `export const entity` de persistence.service.ts. */
function registrarEntidadEnPersistence(servicePath: string, className: string): void {
    if (!existsSync(servicePath)) return;
    let serviceContent = readFileSync(servicePath, 'utf-8');
    const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/entity['"];?/;
    if (importRegex.test(serviceContent)) {
        serviceContent = serviceContent.replace(importRegex, (match, imports) => {
            let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
            if (!importList.includes(className)) importList.push(className);
            importList = Array.from(new Set(importList));
            return `import { ${importList.join(', ')} } from "./entity";`;
        });
    } else {
        serviceContent = `import { ${className} } from "./entity";\n` + serviceContent;
    }
    const entityArrayRegex = /export\s+const\s+entity\s*=\s*\[([^\]]*)\]/;
    if (entityArrayRegex.test(serviceContent)) {
        serviceContent = serviceContent.replace(entityArrayRegex, (match, entities) => {
            let entityList = entities.split(',').map((e: string) => e.trim()).filter(Boolean);
            if (!entityList.includes(className)) entityList.push(className);
            entityList = Array.from(new Set(entityList));
            return `export const entity = [${entityList.join(', ')}]`;
        });
    }
    writeFileSync(servicePath, serviceContent);
}

export async function POST(req: NextRequest) {
    try {
        const { entityName, esquema, atributos, basePath, databaseType } = await req.json();

        // Validaciones básicas
        if (!entityName || !basePath) {
            return NextResponse.json({
                error: 'entityName y basePath son requeridos'
            }, { status: 400 });
        }

        if (!atributos || !Array.isArray(atributos) || atributos.length === 0) {
            return NextResponse.json({
                error: 'Se requiere al menos un atributo'
            }, { status: 400 });
        }

        // Validar que el nombre de la entidad sea válido
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
            return NextResponse.json({
                error: 'El nombre de la entidad debe empezar con mayúscula y contener solo letras y números'
            }, { status: 400 });
        }

        // Validar atributos
        for (const atributo of atributos) {
            if (!atributo.nombreAtributo || !atributo.tipoDato) {
                return NextResponse.json({
                    error: 'Todos los atributos deben tener nombre y tipo de dato'
                }, { status: 400 });
            }

            if (atributo.tipoDato === 'relation' && (!atributo.rEntity || !atributo.tipoRelacion)) {
                return NextResponse.json({
                    error: 'Los atributos de relación deben tener entidad relacionada y tipo de relación'
                }, { status: 400 });
            }
        }

        // La clase exportada SIEMPRE termina en Entity
        const className = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const nombreBase = eliminarSufijo(className, 'Entity');
        const kebab = formatearNombre(nombreBase, '-');
        const nombreTabla = formatearNombre(nombreBase, '_');

        const entityDir = path.join(basePath, 'src/persistence/entity');
        const filePath = path.join(entityDir, `${kebab}.entity.ts`);
        if (existsSync(filePath)) {
            // F1-C4: jamás reescribir una entity existente con el template (destruiría código propio)
            return NextResponse.json({
                error: `La entity ${className} ya existe (${filePath})`
            }, { status: 409 });
        }

        // Procesar atributos y generar código
        let importaciones: string[] = [];
        const atributosCode: string[] = [];
        let typeormExtras: string[] = [];
        const constructorAttrs: { param: string; asignacion: string; requerido: boolean }[] = [];
        const avisos: string[] = [];

        const esquemaEnum = (esquema || 'public').toString().toUpperCase();

        for (const atributo of atributos) {
            if (atributo.tipoDato === 'relation') {
                // Imports typeorm del lado directo
                if (atributo.tipoRelacion === 'OneToOne' || atributo.tipoRelacion === 'ManyToOne') {
                    typeormExtras.push('JoinColumn');
                }
                if (atributo.tipoRelacion === 'ManyToMany') {
                    typeormExtras.push('JoinTable');
                }
                typeormExtras.push(atributo.tipoRelacion);

                // Import de la entidad relacionada
                const kebabRelacionada = formatearNombre(eliminarSufijo(atributo.rEntity, 'Entity'), '-');
                importaciones.push(`import { ${atributo.rEntity} } from './${kebabRelacionada}.entity';`);

                // Nombres compartidos entre lado directo e inversa (F1-C2: el callback del
                // lado dueño apunta SIEMPRE a la propiedad que realmente se inyecta en el destino).
                const coleccionInversa = atributo.tipoRelacion === 'OneToOne'
                    ? aInicialMinuscula(nombreBase)
                    : pluralizarEntidad(className);
                const nombreInversa = aInicialMinuscula(nombreBase);

                atributosCode.push(generarRelacion(atributo, {
                    entidadActual: className,
                    coleccionInversa,
                    nombreInversa,
                }));

                // F1-M5: las relaciones unitarias dueñas de FK van en el constructor
                // (modelo menu-traduccion.entity.ts); las colecciones quedan fuera.
                if (atributo.tipoRelacion === 'ManyToOne' || atributo.tipoRelacion === 'OneToOne') {
                    constructorAttrs.push({
                        param: `${atributo.nombreAtributo}${atributo.nulo === true ? '?' : ''}: ${atributo.rEntity}`,
                        asignacion: `this.${atributo.nombreAtributo} = ${atributo.nombreAtributo};`,
                        requerido: atributo.nulo !== true,
                    });
                }

                // Inyección de la relación inversa en la entidad destino
                const resultado = inyectarRelacionInversa(basePath, {
                    tipoRelacion: atributo.tipoRelacion,
                    nombreAtributo: atributo.nombreAtributo,
                    entidadOrigen: className,
                    entidadDestino: atributo.rEntity,
                    coleccionInversa,
                    nombreInversa,
                    requerido: atributo.nulo !== true,
                }, { esquema: esquemaEnum });
                avisos.push(...resultado.avisos);
            } else {
                // Generar columna normal
                atributosCode.push(generarColumna(atributo, databaseType));
                // El constructor replica la opcionalidad de la propiedad: el mapper
                // pasa createXDto.<attr> (string | undefined si es nulable)
                constructorAttrs.push({
                    param: `${atributo.nombreAtributo}${atributo.nulo === true ? '?' : ''}: ${atributo.tipoDato}`,
                    asignacion: `this.${atributo.nombreAtributo} = ${atributo.nombreAtributo};`,
                    requerido: atributo.nulo !== true,
                });
            }
        }

        // TS1016: un parámetro requerido no puede ir detrás de uno opcional.
        // El mapper (crear-mapper) usa el MISMO orden compartido.
        const constructorOrdenado = ordenRequeridoPrimero(constructorAttrs, (a) => a.requerido);
        const parametrosConstructor = constructorOrdenado.map((a) => a.param);
        const thisAtributos = constructorOrdenado.map((a) => a.asignacion);

        // Deduplicar imports typeorm
        typeormExtras = typeormExtras.filter((item, index) => typeormExtras.indexOf(item) === index);

        // F1-m1: índice único compuesto de clase si hay 2+ atributos únicos (estilo UQ_ de la api)
        let indexDecorator = '';
        const unicos = atributos.filter((a) => a.unico === true);
        if (unicos.length >= 2) {
            if (!typeormExtras.includes('Index')) typeormExtras.push('Index');
            const nombreIndice = `UQ_${nombreTabla}_${unicos.map((u) => snakeDe(u.nombreAtributo)).join('_')}`;
            const columnasIndice = unicos.map((u) => `'${u.nombreAtributo}'`).join(', ');
            indexDecorator = `@Index('${nombreIndice}', [${columnasIndice}], { unique: true, where: '"activo" = true' })\n`;
        }

        const importList = ['Column', 'Entity', ...typeormExtras].join(', ');

        // Preparar el template
        let template = genericEntity;
        template = template.replace('$typeormImport', `import { ${importList} } from 'typeorm';`);
        template = template.replace('$import', importaciones.length > 0 ? importaciones.join('\n') : '');
        template = template.replace('$index', indexDecorator);
        template = template.replace('$entidad', nombreTabla);
        template = template.replace('$schema', esquemaEnum);
        template = template.replace('$nameEntity', className);
        template = template.replace('$atributos', atributosCode.join('\n\n    '));
        template = template.replace('$parametros', parametrosConstructor.join(', '));
        template = template.replace('$thisAtributos', thisAtributos.join('\n        '));
        template = template.replace('$toStringBody', generarToStringBody(atributos));

        // Crear directorio si no existe
        if (!existsSync(entityDir)) {
            mkdirSync(entityDir, { recursive: true });
        }

        // Escribir archivo de entidad
        writeFileSync(filePath, template);

        // Registrar en index.ts y en el registro dinámico de persistence.service.ts
        registrarEntidadEnIndex(entityDir, className, kebab);
        registrarEntidadEnPersistence(path.join(basePath, 'src/persistence/persistence.service.ts'), className);

        return NextResponse.json({
            success: true,
            message: `Entidad ${className} creada exitosamente`,
            filePath: filePath,
            avisos: avisos,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: `Error al crear la entidad: ${message}`
        }, { status: 500 });
    }
}
