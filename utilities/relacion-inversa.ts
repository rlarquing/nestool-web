// Inyección y eliminación quirúrgica de RELACIONES INVERSAS en entities destino.
// Extraído de crear-entidad (fase 3) para compartirlo con actualizar-entidad (F2).
// Reglas: ancla idempotente '// [nestool] inversa de X.y'; jamás tocar un fichero
// que no parsea; poda de imports que quedan sin uso tras una eliminación.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, generarRelacionInversa } from './entity-utils';
import {
    insertarMiembroEnClase, agregarImportAContent, fusionarImportsTypeorm, leerClase,
} from './entity-edicion';
import { genericEntity } from '@/template/entity.template';

// TypeORM imports que necesita la ENTIDAD DESTINO según la relación directa
// que se le inyecta como inversa.
export function typeormImportsInversa(tipoRelacion: string): string[] {
    switch (tipoRelacion) {
        case 'ManyToOne': return ['OneToMany'];
        case 'OneToMany': return ['ManyToOne', 'JoinColumn'];
        case 'OneToOne': return ['OneToOne'];
        case 'ManyToMany': return ['ManyToMany'];
        default: return [];
    }
}

/** Nombre de la propiedad que declara el bloque inverso generado. */
export function nombrePropiedadInversa(bloque: string): string | null {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = lineas.length - 1; i >= 0; i--) {
        const match = lineas[i].match(/^([A-Za-z_$][\w$]*)[?!]?:\s*[A-Za-z_$][\w$]*(\[\])?;/);
        if (match) return match[1];
    }
    return null;
}

export interface ResultadoInyeccion {
    avisos: string[];
    insertado: boolean;
    creadaNueva: boolean;
}

/**
 * Inyecta la relación inversa en la entity destino (F1-C1/C4/C5):
 *  - fichero existente: edición quirúrgica con ancla idempotente, sin reescribir nada más;
 *  - fichero inexistente: se crea con el template completo (GenericEntity + schema + orderBy)
 *    y se registra en index.ts y en el registro dinámico de persistence.service.ts (F1-M4).
 */
export function inyectarRelacionInversa(
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
        return { avisos, insertado: false, creadaNueva: false };
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
            avisos.push(`La inversa de ${ctx.entidadOrigen}.${ctx.nombreAtributo} ya existía en ${ctx.entidadDestino}: no se duplicó.`);
            return { avisos, insertado: false, creadaNueva: false };
        }
        // Colisión de propiedad: no corromper el fichero
        const propiedad = nombrePropiedadInversa(bloque);
        if (propiedad && new RegExp(`\\b${propiedad}\\s*[?!]?:`).test(destinoContent!)) {
            avisos.push(`Entity ${ctx.entidadDestino} ya declara la propiedad "${propiedad}": no se inyectó la inversa duplicada.`);
            return { avisos, insertado: false, creadaNueva: false };
        }
        const insertado = insertarMiembroEnClase(destinoContent!, bloque);
        if (insertado === null) {
            avisos.push(`No se encontró el cuerpo de la clase en ${ctx.entidadDestino}: NO se inyectó la relación inversa.`);
            return { avisos, insertado: false, creadaNueva: false };
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
    return { avisos, insertado: true, creadaNueva: esNueva };
}

/**
 * Elimina de la entity destino el bloque inverso marcado con el ancla
 * '// [nestool] inversa de <entidadOrigen>.<nombreAtributo>' (solo bloques
 * generados por nestool; las inversas escritas a mano se dejan y se avisan).
 * Poda imports de typeorm y de la entity origen que quedaran sin uso.
 */
export function eliminarRelacionInversa(
    basePath: string,
    entidadOrigen: string,
    nombreAtributo: string,
): { avisos: string[]; eliminado: boolean } {
    const avisos: string[] = [];
    const entityDir = path.join(basePath, 'src/persistence/entity');
    if (!existsSync(entityDir)) return { avisos, eliminado: false };
    const ancla = `// [nestool] inversa de ${entidadOrigen}.${nombreAtributo}`;

    let eliminado = false;
    for (const fichero of readdirSync(entityDir)) {
        if (!fichero.endsWith('.entity.ts') || fichero === 'index.ts') continue;
        const filePath = path.join(entityDir, fichero);
        const content = readFileSync(filePath, 'utf-8');
        if (!content.includes(ancla)) continue;

        const lineas = content.split('\n');
        const idxAncla = lineas.findIndex((l) => l.includes(ancla));
        if (idxAncla === -1) continue;
        // El bloque inyectado tiene forma conocida: ancla + decoradores + propiedad ';'.
        let fin = -1;
        for (let j = idxAncla + 1; j < lineas.length && j <= idxAncla + 12; j++) {
            const t = lineas[j].trim();
            if (!t || t.startsWith('//')) continue;
            if (/;\s*$/.test(t) && !t.startsWith('@')) { fin = j; break; }
        }
        if (fin === -1) {
            avisos.push(`Ancla encontrada en ${fichero} pero no se delimitó el bloque: no se eliminó (hazlo a mano).`);
            continue;
        }
        lineas.splice(idxAncla, fin - idxAncla + 1);
        let nuevo = lineas.join('\n').replace(/\n{3,}/g, '\n\n');

        // Poda del import de la entity origen si quedó sin uso (fuera de imports).
        nuevo = podarImportSinUso(nuevo, entidadOrigen);
        // Poda de identificadores typeorm sin uso (noUnusedLocals).
        nuevo = podarImportsTypeormSinUso(nuevo);

        writeFileSync(filePath, nuevo);
        eliminado = true;
        avisos.push(`Inversa de ${entidadOrigen}.${nombreAtributo} eliminada de ${fichero}.`);
    }
    return { avisos, eliminado };
}

/** Elimina las líneas `import ... { X } ...` si X ya no aparece en el resto del fichero. */
function podarImportSinUso(content: string, className: string): string {
    const sinImports = content.replace(/^(import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\s*\n?)/gm, '');
    const usos = (sinImports.match(new RegExp(`\\b${className}\\b`, 'g')) ?? []).length;
    if (usos > 0) return content; // aún se usa fuera de los imports: no tocar
    return content.replace(new RegExp(`^import\\s*\\{[^}]*\\b${className}\\b[^}]*\\}\\s*from\\s*['"][^'"]+['"];?\\s*\\n?`, 'gm'), '');
}

/** Quita del import de 'typeorm' los identificadores que no se usan en el cuerpo. */
export function podarImportsTypeormSinUso(content: string): string {
    const regex = /import\s*\{([^}]*)\}\s*from\s*['"]typeorm['"];?/;
    const match = content.match(regex);
    if (!match) return content;
    const lineaImport = match[0];
    const resto = content.replace(lineaImport, '');
    const usados = match[1].split(',').map((s) => s.trim()).filter(Boolean).filter((id) => {
        const usa = new RegExp(`\\b${id}\\b`).test(resto);
        return usa;
    });
    if (usados.length === match[1].split(',').map((s) => s.trim()).filter(Boolean).length) return content;
    if (usados.length === 0) return content.replace(lineaImport + '\n', '').replace(lineaImport, '');
    return content.replace(lineaImport, `import { ${usados.join(', ')} } from 'typeorm';`);
}

/** Registra la entity en entity/index.ts (formato con espacios, igual al resto). */
export function registrarEntidadEnIndex(entityDir: string, className: string, kebab: string): void {
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
export function registrarEntidadEnPersistence(servicePath: string, className: string): void {
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
