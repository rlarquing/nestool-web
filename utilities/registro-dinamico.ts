import * as ts from 'typescript';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// F8-M1: un único "registrar slice" con parser TS para TODOS los registros
// dinámicos de la api destino (persistence.service.ts, core.service.ts,
// api.service.ts). Sustituye a los parches regex de crear-repository,
// crear-mapper, crear-service, crear-controller y a
// registrarEntidadEnPersistence (utilities/relacion-inversa.ts).
//
//  - PARSER TS: localiza `export const <nombre> = [...]` y los imports por
//    AST; NO depende del formato exacto del fichero (prettier puede
//    reformatear, haber espacios dobles como `export  const entity`, comas
//    finales o no, una o varias líneas).
//  - SPLICE MÍNIMO: se inserta el nuevo símbolo DESPUÉS del último elemento
//    existente replicando su indentación; el resto del fichero queda
//    byte a byte igual (no se colapsa el array a una línea como hacía el
//    regex antiguo).
//  - IDEMPOTENTE: si el símbolo ya está, no se escribe nada (modificado=false).

export interface RegistroResultado {
    /** true si el ancla se encontró y la operación fue posible */
    ok: boolean;
    /** true si se escribió el fichero (false = ya estaba o nada que hacer) */
    modificado: boolean;
    /** detalle cuando ok=false (ancla no encontrada, fichero ilegible, ...) */
    motivo?: string;
}

function parseFichero(fichero: string, contenido: string): ts.SourceFile {
    return ts.createSourceFile(fichero, contenido, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TS);
}

/** Indentación (espacios/tab) de la línea donde empieza el nodo en `texto`. */
function indentoDe(texto: string, pos: number): string {
    let i = pos - 1;
    let out = '';
    while (i >= 0 && (texto[i] === ' ' || texto[i] === '\t')) {
        out = texto[i] + out;
        i--;
    }
    return out;
}

function leer(fichero: string): { contenido?: string; motivo?: string } {
    if (!existsSync(fichero)) return { motivo: `${fichero} no existe` };
    try {
        return { contenido: readFileSync(fichero, 'utf-8') };
    } catch (e) {
        return { motivo: `${fichero} no es legible (${e instanceof Error ? e.message : String(e)})` };
    }
}

function escribir(fichero: string, contenido: string): RegistroResultado | null {
    try {
        writeFileSync(fichero, contenido);
        return null;
    } catch (e) {
        return { ok: false, modificado: false, motivo: `no se pudo escribir ${fichero}: ${e instanceof Error ? e.message : String(e)}` };
    }
}

/** Splice mínimo de `añadido` en la posición `insertAt` de `contenido`. */
function splice(contenido: string, insertAt: number, añadido: string): string {
    return contenido.slice(0, insertAt) + añadido + contenido.slice(insertAt);
}

/**
 * Añade `simbolo` al array `export const <nombreArray> = [...]` del fichero.
 * Idempotente; splice mínimo que preserva el formato on-disk.
 */
export function registrarEnArray(fichero: string, nombreArray: string, simbolo: string): RegistroResultado {
    const lectura = leer(fichero);
    if (lectura.motivo !== undefined) return { ok: false, modificado: false, motivo: lectura.motivo };
    const contenido = lectura.contenido as string;
    const src = parseFichero(fichero, contenido);

    let arrayLiteral: ts.ArrayLiteralExpression | undefined;
    for (const st of src.statements) {
        if (!ts.isVariableStatement(st)) continue;
        const esExport = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!esExport) continue;
        for (const d of st.declarationList.declarations) {
            if (ts.isIdentifier(d.name) && d.name.text === nombreArray && d.initializer && ts.isArrayLiteralExpression(d.initializer)) {
                arrayLiteral = d.initializer;
            }
        }
    }
    if (!arrayLiteral) {
        return { ok: false, modificado: false, motivo: `no se encontró 'export const ${nombreArray} = [...]' en ${fichero}` };
    }

    const elementos = arrayLiteral.elements;
    if (elementos.some((e) => e.getText().trim() === simbolo)) {
        return { ok: true, modificado: false }; // idempotente: ya registrado
    }

    let insertAt: number;
    let añadido: string;
    if (elementos.length === 0) {
        insertAt = arrayLiteral.getStart() + 1;
        añadido = simbolo;
    } else {
        const ultimo = elementos[elementos.length - 1];
        const indent = indentoDe(contenido, ultimo.getStart());
        const multilinea = contenido.slice(arrayLiteral.getStart(), arrayLiteral.getEnd()).includes('\n');
        insertAt = ultimo.getEnd();
        añadido = multilinea ? `,\n${indent}${simbolo}` : `, ${simbolo}`;
    }

    const errorEscritura = escribir(fichero, splice(contenido, insertAt, añadido));
    if (errorEscritura) return errorEscritura;
    return { ok: true, modificado: true };
}

/**
 * Añade `simbolos` a los named imports del módulo `modulo` (p.ej. './mapper')
 * en el fichero. Si no existe ningún import con named bindings de ese módulo,
 * crea uno nuevo tras el último import (ancla AST). Idempotente.
 */
export function registrarImport(fichero: string, modulo: string, simbolos: string[]): RegistroResultado {
    const lectura = leer(fichero);
    if (lectura.motivo !== undefined) return { ok: false, modificado: false, motivo: lectura.motivo };
    const contenido = lectura.contenido as string;
    const src = parseFichero(fichero, contenido);

    const imports = src.statements.filter(ts.isImportDeclaration);
    const importDeModulo = imports.find((imp) => {
        const spec = imp.moduleSpecifier;
        return ts.isStringLiteral(spec) && spec.text === modulo;
    });

    if (
        importDeModulo &&
        importDeModulo.importClause?.namedBindings &&
        ts.isNamedImports(importDeModulo.importClause.namedBindings)
    ) {
        const elementos = importDeModulo.importClause.namedBindings.elements;
        const existentes = new Set(elementos.map((e) => e.name.text));
        const faltan = simbolos.filter((s) => !existentes.has(s));
        if (faltan.length === 0) return { ok: true, modificado: false };

        let insertAt: number;
        let añadido: string;
        if (elementos.length === 0) {
            insertAt = importDeModulo.importClause.namedBindings.getStart() + 1;
            añadido = faltan.join(', ');
        } else {
            const ultimo = elementos[elementos.length - 1];
            const indent = indentoDe(contenido, ultimo.getStart());
            const multilinea = contenido.slice(importDeModulo.getStart(), importDeModulo.getEnd()).includes('\n');
            insertAt = ultimo.getEnd();
            añadido = multilinea ? `,\n${indent}${faltan.join(`,\n${indent}`)}` : `, ${faltan.join(', ')}`;
        }
        const errorEscritura = escribir(fichero, splice(contenido, insertAt, añadido));
        if (errorEscritura) return errorEscritura;
        return { ok: true, modificado: true };
    }

    // No hay import con named bindings de ese módulo: crear uno nuevo tras el
    // último import (o al inicio del fichero si no hay imports).
    const declaracion = `import { ${simbolos.join(', ')} } from '${modulo}';`;
    let nuevo: string;
    if (imports.length > 0) {
        const finUltimo = imports[imports.length - 1].getEnd();
        nuevo = splice(contenido, finUltimo, `\n${declaracion}`);
    } else {
        nuevo = `${declaracion}\n${contenido}`;
    }
    const errorEscritura = escribir(fichero, nuevo);
    if (errorEscritura) return errorEscritura;
    return { ok: true, modificado: true };
}

/** Resultado combinado de varias operaciones de registro. */
export function combinarRegistros(nombreFase: string, ...resultados: RegistroResultado[]): RegistroResultado {
    const ok = resultados.every((r) => r.ok);
    const modificado = resultados.some((r) => r.modificado);
    const motivos = resultados.filter((r) => r.motivo).map((r) => r.motivo as string);
    return {
        ok,
        modificado,
        motivo: motivos.length > 0 ? `${nombreFase}: ${motivos.join('; ')}` : undefined,
    };
}
