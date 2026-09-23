// Motor de edición quirúrgica de entities (F2). Sustituye a la reescritura
// destructiva de actualizar-entidad:
//  - Diff por NOMBRE entre los atributos deseados (UI) y los reales del fichero.
//  - Los atributos existentes JAMÁS se re-emitieren (el round-trip de la UI es
//    lossy): quedan byte a byte como estaban (F2-C1/C2/C4/C5).
//  - Los nuevos se insertan con los generadores corregidos de fase 3
//    (generarColumna/generarRelacion) + cirugía de constructor (F2-M1/M2).
//  - Los eliminados se quitan por bloque (decoradores + propiedad) con
//    verificación de referencias y limpieza del constructor.
import { parseEntityContent, type AtributoEntity } from './entity-parser';
import {
    generarColumna, generarRelacion, pluralizarEntidad, aInicialMinuscula,
    eliminarSufijo, formatearNombre,
} from './entity-utils';
import { insertarMiembroEnClase, fusionarImportsTypeorm, agregarImportAContent } from './entity-edicion';

export interface AtributoEntrada {
    nombreAtributo: string;
    tipoDato: string; // 'string' | 'number' | ... | 'relation'
    length?: string | number;
    integer?: boolean;
    rEntity?: string;
    tipoRelacion?: string;
    nulo?: boolean;
    unico?: boolean;
}

export interface DetalleCambio {
    nombreAtributo: string;
    tipoDato: string;
    tipoRelacion?: string;
    rEntity?: string;
    nulo?: boolean;
}

export interface ResultadoSync {
    contenido: string;
    cambio: boolean;
    agregados: DetalleCambio[];
    eliminados: DetalleCambio[];
    sinCambios: string[];
    avisos: string[];
}

const TYPEORM_POR_RELACION: Record<string, string[]> = {
    OneToOne: ['OneToOne', 'JoinColumn'],
    ManyToOne: ['ManyToOne', 'JoinColumn'],
    OneToMany: ['OneToMany'],
    ManyToMany: ['ManyToMany', 'JoinTable'],
};

/** Tipo TypeScript del parámetro de constructor (misma normalización que el mapper). */
function tipoTsParametro(attr: AtributoEntrada): string {
    if (attr.tipoDato === 'Timestamp') return 'Date';
    return attr.tipoDato;
}

/** Normaliza la entrada de la UI al formato de los generadores (nulo/unico booleanos). */
function normalizar(attr: AtributoEntrada): AtributoEntrada {
    return {
        ...attr,
        nulo: attr.nulo === true,
        unico: attr.unico === true,
        length: attr.length !== undefined && attr.length !== ('' as unknown as number) ? Number(attr.length) : undefined,
    };
}

export function sincronizarAtributosEntity(entrada: {
    contenido: string;
    className: string;
    deseados: AtributoEntrada[];
    databaseType?: string;
}): ResultadoSync {
    const { contenido, className, deseados, databaseType = 'postgresql' } = entrada;
    const avisos: string[] = [];

    const parsed = parseEntityContent(contenido);
    if (!parsed) {
        throw new Error(`La entity ${className} no se pudo parsear: no se toca el fichero.`);
    }

    const actuales = new Map<string, AtributoEntity>(parsed.atributos.map((a) => [a.nombre, a]));
    const nombresDeseados = new Set(deseados.map((d) => d.nombreAtributo));

    const agregados: DetalleCambio[] = [];
    const eliminados: DetalleCambio[] = [];
    const sinCambios: string[] = [];

    for (const d of deseados) {
        if (actuales.has(d.nombreAtributo)) {
            sinCambios.push(d.nombreAtributo);
        } else {
            agregados.push(d.tipoDato === 'relation'
                ? { nombreAtributo: d.nombreAtributo, tipoDato: 'relation', tipoRelacion: d.tipoRelacion, rEntity: d.rEntity, nulo: d.nulo === true }
                : { nombreAtributo: d.nombreAtributo, tipoDato: d.tipoDato, nulo: d.nulo === true });
        }
    }
    for (const a of parsed.atributos) {
        if (!nombresDeseados.has(a.nombre)) {
            eliminados.push(a.tipo === 'relacion'
                ? { nombreAtributo: a.nombre, tipoDato: 'relation', tipoRelacion: a.tipoRelacion, rEntity: a.destino }
                : { nombreAtributo: a.nombre, tipoDato: a.tipoTs });
        }
    }

    let lineas = contenido.split('\n');
    let contenidoActual = contenido;

    // ---------------- ELIMINACIONES (bloque + constructor) ----------------
    for (const elim of eliminados) {
        let bloque = localizarBloqueAtributo(lineas, elim.nombreAtributo);
        if (!bloque) {
            avisos.push(`"${elim.nombreAtributo}" ya no está en el fichero: nada que eliminar.`);
            continue;
        }
        const referencias = referenciasExternas(lineas, bloque, elim.nombreAtributo);
        if (referencias.length > 0) {
            avisos.push(`"${elim.nombreAtributo}" se usa en el código propio de la clase (línea ${referencias.join(', ')}): NO se eliminó (hazlo a mano).`);
            continue;
        }
        lineas = quitarDelConstructor(lineas, elim.nombreAtributo);
        // Re-localizar: la cirugía del constructor puede mover los índices.
        bloque = localizarBloqueAtributo(lineas, elim.nombreAtributo);
        if (bloque) {
            lineas.splice(bloque.inicio, bloque.fin - bloque.inicio + 1);
        }
    }
    if (eliminados.length > 0) {
        contenidoActual = lineas.join('\n').replace(/\n{3,}/g, '\n\n');
        lineas = contenidoActual.split('\n');
    }

    // ---------------- ADICIONES (snippets + imports + constructor) ----------------
    const nombreBase = eliminarSufijo(className, 'Entity');
    const snippets: string[] = [];
    const typeormPedidos: string[] = [];
    const importsEntidad: { clase: string; linea: string }[] = [];
    const constructorNuevos: { param: string; asignacion: string; requerido: boolean }[] = [];

    for (const d of deseados) {
        if (actuales.has(d.nombreAtributo)) continue;
        const attr = normalizar(d);

        if (attr.tipoDato === 'relation') {
            const tipoRelacion = attr.tipoRelacion ?? 'ManyToOne';
            const rEntity = attr.rEntity;
            if (!rEntity) {
                avisos.push(`"${attr.nombreAtributo}" es relation sin entidad relacionada: no se añadió.`);
                continue;
            }
            const coleccionInversa = tipoRelacion === 'OneToOne'
                ? aInicialMinuscula(nombreBase)
                : pluralizarEntidad(className);
            const nombreInversa = aInicialMinuscula(nombreBase);
            snippets.push(generarRelacion({ ...attr, tipoRelacion, rEntity }, {
                entidadActual: className,
                coleccionInversa,
                nombreInversa,
            }));
            typeormPedidos.push(...(TYPEORM_POR_RELACION[tipoRelacion] ?? []));
            const kebabRelacionada = formatearNombre(eliminarSufijo(rEntity, 'Entity'), '-'); // F2-M3: kebab real
            importsEntidad.push({
                clase: rEntity,
                linea: `import { ${rEntity} } from './${kebabRelacionada}.entity';`,
            });
            // F2-M2: solo relaciones unitarias dueñas de FK en el constructor (modelo F1-M5)
            if (tipoRelacion === 'ManyToOne' || tipoRelacion === 'OneToOne') {
                constructorNuevos.push({
                    param: `${attr.nombreAtributo}${attr.nulo === true ? '?' : ''}: ${rEntity}`,
                    asignacion: `this.${attr.nombreAtributo} = ${attr.nombreAtributo};`,
                    requerido: attr.nulo !== true,
                });
            }
        } else {
            snippets.push(generarColumna(attr, databaseType)); // F2-M1: nullable siempre explícito
            typeormPedidos.push('Column');
            constructorNuevos.push({
                param: `${attr.nombreAtributo}${attr.nulo === true ? '?' : ''}: ${tipoTsParametro(attr)}`,
                asignacion: `this.${attr.nombreAtributo} = ${attr.nombreAtributo};`,
                requerido: attr.nulo !== true,
            });
        }
    }

    if (snippets.length > 0) {
        const combinado = snippets.join('\n\n    ');
        const insertado = insertarMiembroEnClase(contenidoActual, combinado);
        if (insertado === null) {
            avisos.push('No se encontró el cuerpo de la clase: los atributos nuevos NO se añadieron.');
        } else {
            contenidoActual = insertado;
            // Imports typeorm (merge sin duplicados, F2-C2)
            contenidoActual = fusionarImportsTypeorm(contenidoActual, Array.from(new Set(typeormPedidos)));
            // Imports de entities relacionadas con ruta kebab correcta (F2-M3)
            for (const imp of importsEntidad) {
                if (!contenidoActual.includes(imp.linea)) {
                    contenidoActual = agregarImportAContent(contenidoActual, imp.linea);
                }
            }
            // Cirugía de constructor (F2-M2): requeridos antes del primer opcional (TS1016)
            contenidoActual = añadirAlConstructor(contenidoActual, constructorNuevos, avisos);
        }
    }

    // ---------------- PODA DE IMPORTS TRAS ELIMINACIONES ----------------
    if (eliminados.length > 0) {
        contenidoActual = podarTypeorm(contenidoActual);
        for (const eli of eliminados) {
            if (eli.tipoDato === 'relation' && eli.rEntity) {
                contenidoActual = podarImportEntidad(contenidoActual, eli.rEntity);
            }
        }
    }

    // Cosmética: colapsar 3+ saltos (fruto de inserciones) a uno en blanco.
    contenidoActual = contenidoActual.replace(/\n{3,}/g, '\n\n');

    const cambio = contenidoActual !== contenido;
    if (!cambio && (agregados.length > 0 || eliminados.length > 0)) {
        avisos.push('El resultado no difiere del fichero original: no se escribió nada.');
    }
    return {
        contenido: contenidoActual,
        cambio,
        agregados,
        eliminados,
        sinCambios,
        avisos,
    };
}

// ---------------------- LOCALIZACIÓN DE BLOQUES ----------------------

export interface RangoBloque { inicio: number; fin: number; }

/**
 * Localiza el bloque completo de un atributo (líneas de comentario propias +
 * decoradores apilados, multi-línea, + línea de la propiedad). Devuelve el
 * rango [inicio..fin] de líneas (inclusive) o null si no aparece.
 */
export function localizarBloqueAtributo(lineas: string[], nombre: string): RangoBloque | null {
    const rePropiedad = new RegExp(`^${nombre}\\s*[?!]?\\s*:`);
    const rePropiedadMismaLinea = new RegExp(`\\)\\s*(${nombre}\\s*[?!]?\\s*:[^;]+;)\\s*$`);
    // 'export'/'class' cierran el scan: si el bloque arranca en un decorador de
    // CLASE (@Entity, @Index...) no existe propiedad asociada (F2: sin esto, la
    // eliminación se tragaba la declaración de la clase entera).
    const reTerminador = /^\s*(export\b|class\b|constructor\b|super\b|return\b|this\.|const |let |if |for |async |static |private |public |protected )/;
    const reDecoradorDeClase = /^@(Entity|Index|Unique|ChildEntity|TableInheritance)\b/;

    for (let i = 0; i < lineas.length; i++) {
        const t = lineas[i].trim();
        if (!t.startsWith('@')) continue;
        if (reDecoradorDeClase.test(t)) continue; // decorador de clase: no es un atributo

        // Comentarios contiguos inmediatamente encima documentan el atributo.
        let inicio = i;
        for (let k = i - 1; k >= 0; k--) {
            const tk = lineas[k].trim();
            if (tk.startsWith('//') || (tk.startsWith('/*') && tk.endsWith('*/'))) inicio = k;
            else break;
        }

        let fin = -1;
        let j = i;
        while (j < lineas.length && j - i <= 40) { // cota: bloque de atributo acotado
            const tj = lineas[j].trim();
            if (tj.startsWith('@')) {
                const mismaLinea = tj.match(rePropiedadMismaLinea);
                if (mismaLinea) { fin = j; break; }
                j++;
                continue;
            }
            if (tj === '') { j++; continue; }
            if (tj.startsWith('//')) { j++; continue; }
            if (rePropiedad.test(tj) && /;\s*$/.test(tj)) { fin = j; break; }
            if (reTerminador.test(tj)) break;
            j++;
        }
        if (fin !== -1) return { inicio, fin };
    }
    return null;
}

/**
 * Líneas (índices 1-based) fuera del bloque donde `this.<nombre>` se usa para
 * algo distinto de la asignación del constructor (`this.x = x;`): toString,
 * métodos propios.
 */
function referenciasExternas(lineas: string[], bloque: RangoBloque, nombre: string): number[] {
    const fuera: number[] = [];
    const reUso = new RegExp(`\\bthis\\.${nombre}\\b`);
    const reAsignacion = new RegExp(`^\\s*this\\.${nombre}\\s*=[^=]`);
    for (let i = 0; i < lineas.length; i++) {
        if (i >= bloque.inicio && i <= bloque.fin) continue;
        if (reUso.test(lineas[i]) && !reAsignacion.test(lineas[i])) fuera.push(i + 1);
    }
    return fuera;
}

// ---------------------- CIRUGÍA DE CONSTRUCTOR ----------------------

/** Divide el texto de parámetros por comas de nivel superior (respeta <> y ()). */
function partirParams(texto: string): string[] {
    const partes: string[] = [];
    let depth = 0;
    let actual = '';
    for (const c of texto) {
        if (c === '(' || c === '<') depth++;
        else if (c === ')' || c === '>') depth--;
        if (c === ',' && depth === 0) {
            partes.push(actual);
            actual = '';
            continue;
        }
        actual += c;
    }
    if (actual.trim()) partes.push(actual);
    return partes.map((p) => p.trim()).filter(Boolean);
}

interface ConstructorPos {
    apertura: number;       // línea con 'constructor('
    cierreParams: number;   // línea con el ')' que cierra los params
    aperturaCuerpo: number; // línea con la '{' del cuerpo
    cierreCuerpo: number;   // línea con la '}' que cierra el cuerpo
}

function localizarConstructor(lineas: string[]): ConstructorPos | null {
    const idx = lineas.findIndex((l) => /^\s*constructor\s*\(/.test(l));
    if (idx === -1) return null;
    // Cierre del paréntesis de parámetros
    let depth = 0;
    let cierreParams = -1;
    for (let i = idx; i < lineas.length; i++) {
        for (const c of lineas[i]) {
            if (c === '(') depth++;
            else if (c === ')') {
                depth--;
                if (depth === 0) { cierreParams = i; break; }
            }
        }
        if (cierreParams !== -1) break;
    }
    if (cierreParams === -1) return null;
    // Apertura del cuerpo
    let aperturaCuerpo = -1;
    for (let i = cierreParams; i < lineas.length; i++) {
        if (lineas[i].includes('{')) { aperturaCuerpo = i; break; }
    }
    if (aperturaCuerpo === -1) return null;
    // Cierre del cuerpo (llaves balanceadas)
    let balance = 0;
    for (let i = aperturaCuerpo; i < lineas.length; i++) {
        for (const c of lineas[i]) {
            if (c === '{') balance++;
            else if (c === '}') {
                balance--;
                if (balance === 0) {
                    // Constructor íntegramente en una línea (params + cuerpo): no se toca
                    if (cierreParams === idx && i === idx) return null;
                    return { apertura: idx, cierreParams, aperturaCuerpo, cierreCuerpo: i };
                }
            }
        }
    }
    return null;
}

/**
 * Añade params/asignaciones al constructor. Requeridos antes del primer
 * opcional (TS1016); opcionales al final. Conserva el formato multi-línea o
 * en-línea del original y el texto posterior al ')' de cierre.
 */
function añadirAlConstructor(
    contenido: string,
    nuevos: { param: string; asignacion: string; requerido: boolean }[],
    avisos: string[],
): string {
    if (nuevos.length === 0) return contenido;
    const lineas = contenido.split('\n');
    const ctor = localizarConstructor(lineas);
    if (!ctor) {
        avisos.push('La entity no tiene constructor utilizable: los atributos nuevos NO reciben parámetro de constructor (revísalo a mano).');
        return contenido;
    }

    const lineaApertura = lineas[ctor.apertura];
    const aperturaParen = lineaApertura.indexOf('(');
    const lineaCierre = lineas[ctor.cierreParams];
    const cierreParen = lineaCierre.lastIndexOf(')');
    const sufijoCierre = lineaCierre.slice(cierreParen + 1); // p.ej. ' {' o ''

    // Texto de parámetros entre ambos paréntesis
    let textoParams: string;
    if (ctor.cierreParams === ctor.apertura) {
        textoParams = lineaApertura.slice(aperturaParen + 1, lineaApertura.lastIndexOf(')'));
    } else {
        const primera = lineaApertura.slice(aperturaParen + 1);
        const intermedias = lineas.slice(ctor.apertura + 1, ctor.cierreParams);
        textoParams = [primera, ...intermedias, lineaCierre.slice(0, cierreParen)].join(' ');
    }

    const params = partirParams(textoParams);
    const idxPrimerOpcional = params.findIndex((p) => /^[A-Za-z_$][\w$]*\?/.test(p));
    const requeridos = nuevos.filter((n) => n.requerido).map((n) => n.param);
    const opcionales = nuevos.filter((n) => !n.requerido).map((n) => n.param);
    const posicion = idxPrimerOpcional === -1 ? params.length : idxPrimerOpcional;
    params.splice(posicion, 0, ...requeridos, ...opcionales);

    // Reescribir la región de parámetros conservando el estilo del fichero
    let reconstruidas: string[];
    if (ctor.cierreParams === ctor.apertura) {
        reconstruidas = [...lineas];
        reconstruidas[ctor.apertura] = `${lineaApertura.slice(0, aperturaParen + 1)}${params.join(', ')})${sufijoCierre}`;
    } else {
        const multilinea = [
            `${lineaApertura.slice(0, aperturaParen + 1)}`,
            ...params.map((p) => `        ${p},`),
            `    )${sufijoCierre}`,
        ];
        reconstruidas = [
            ...lineas.slice(0, ctor.apertura),
            ...multilinea,
            ...lineas.slice(ctor.cierreParams + 1),
        ];
    }

    // Re-localizar el constructor tras reescribir los params y añadir asignaciones
    const ctor2 = localizarConstructor(reconstruidas);
    if (ctor2) {
        // Heredar la indentación del cuerpo (nativas con 2-3 espacios, generadas con 4/8)
        let indent = '        ';
        for (let i = ctor2.aperturaCuerpo + 1; i < ctor2.cierreCuerpo; i++) {
            const m = reconstruidas[i].match(/^(\s*)this\./);
            if (m) { indent = m[1]; break; }
        }
        const nuevasAsignaciones = nuevos.map((n) => `${indent}${n.asignacion}`);
        reconstruidas.splice(ctor2.cierreCuerpo, 0, ...nuevasAsignaciones);
    }
    return reconstruidas.join('\n');
}

/** Quita param y asignación del constructor para un atributo eliminado. */
function quitarDelConstructor(lineas: string[], nombre: string): string[] {
    const ctor = localizarConstructor(lineas);
    if (!ctor) return lineas;
    const lineaApertura = lineas[ctor.apertura];
    const aperturaParen = lineaApertura.indexOf('(');
    const lineaCierre = lineas[ctor.cierreParams];
    const cierreParen = lineaCierre.lastIndexOf(')');
    const sufijoCierre = lineaCierre.slice(cierreParen + 1);

    // Asignaciones `this.x = x;` (por línea, el cuerpo siempre es multi-línea aquí)
    const reAsignacion = new RegExp(`^\\s*this\\.${nombre}\\s*=[^=]`);
    const sinAsignaciones = lineas.filter((l, i) => {
        if (i > ctor.aperturaCuerpo && i < ctor.cierreCuerpo && reAsignacion.test(l)) return false;
        return true;
    });

    // Parámetro por TEXTO (los params pueden estar todos en una línea)
    const ctor2 = localizarConstructor(sinAsignaciones);
    if (!ctor2) return sinAsignaciones;
    const apertura2 = sinAsignaciones[ctor2.apertura].indexOf('(');
    let textoParams: string;
    if (ctor2.cierreParams === ctor2.apertura) {
        textoParams = sinAsignaciones[ctor2.apertura].slice(apertura2 + 1, sinAsignaciones[ctor2.apertura].lastIndexOf(')'));
    } else {
        const primera = sinAsignaciones[ctor2.apertura].slice(apertura2 + 1);
        const intermedias = sinAsignaciones.slice(ctor2.apertura + 1, ctor2.cierreParams);
        textoParams = [primera, ...intermedias, sinAsignaciones[ctor2.cierreParams].slice(0, sinAsignaciones[ctor2.cierreParams].lastIndexOf(')'))].join(' ');
    }
    const params = partirParams(textoParams);
    const reParam = new RegExp(`^${nombre}\\s*[?!]?\\s*:`);
    if (!params.some((p) => reParam.test(p))) return sinAsignaciones;
    const restantes = params.filter((p) => !reParam.test(p));

    let reconstruidas: string[];
    if (ctor2.cierreParams === ctor2.apertura) {
        reconstruidas = [...sinAsignaciones];
        reconstruidas[ctor2.apertura] = `${sinAsignaciones[ctor2.apertura].slice(0, apertura2 + 1)}${restantes.join(', ')})${sufijoCierre}`;
    } else {
        const multilinea = [
            `${sinAsignaciones[ctor2.apertura].slice(0, apertura2 + 1)}`,
            ...restantes.map((p) => `        ${p},`),
            `    )${sufijoCierre}`,
        ];
        reconstruidas = [
            ...sinAsignaciones.slice(0, ctor2.apertura),
            ...multilinea,
            ...sinAsignaciones.slice(ctor2.cierreParams + 1),
        ];
    }
    return reconstruidas;
}

// ---------------------- ORDEN POSICIONAL (fuente de verdad: el constructor real) ----------------------

/**
 * Devuelve los atributos constructorables ordenados como el CONSTRUCTOR REAL
 * de la entity (el único orden correcto para `new XEntity(...)` posicional).
 * Si no hay constructor utilizable devuelve null (el llamador cae al orden
 * canónico requeridos-primero). Si el constructor omite algún atributo
 * constructorable REQUERIDO, también devuelve null: ninguna estrategia puede
 * fabricar una llamada válida y el error debe verse en compilación.
 */
export function ordenSegunConstructor(contenido: string, atributos: AtributoEntity[]): AtributoEntity[] | null {
    const lineas = contenido.split('\n');
    const ctor = localizarConstructor(lineas);
    if (!ctor) return null;
    const lineaApertura = lineas[ctor.apertura];
    const aperturaParen = lineaApertura.indexOf('(');
    let textoParams: string;
    if (ctor.cierreParams === ctor.apertura) {
        textoParams = lineaApertura.slice(aperturaParen + 1, lineaApertura.lastIndexOf(')'));
    } else {
        const primera = lineaApertura.slice(aperturaParen + 1);
        const intermedias = lineas.slice(ctor.apertura + 1, ctor.cierreParams);
        textoParams = [primera, ...intermedias, lineas[ctor.cierreParams].slice(0, lineas[ctor.cierreParams].lastIndexOf(')'))].join(' ');
    }
    const nombres = partirParams(textoParams)
        .map((p) => p.replace(/^(private|protected|public|readonly)\s+/, '').match(/^([A-Za-z_$][\w$]*)/)?.[1])
        .filter((n): n is string => Boolean(n));
    if (nombres.length === 0) return null;
    const porNombre = new Map(atributos.map((a) => [a.nombre, a] as const));
    const ordenados: AtributoEntity[] = [];
    for (const n of nombres) {
        const a = porNombre.get(n);
        if (a) {
            ordenados.push(a);
            porNombre.delete(n);
        }
    }
    const faltantes = [...porNombre.values()];
    const faltanteRequerido = faltantes.some((a) => (a.tipo === 'columna' ? !a.opcional : !a.opcional));
    if (faltanteRequerido) return null;
    return ordenados;
}

/** Quita del import de 'typeorm' los identificadores sin uso (noUnusedLocals). */
function podarTypeorm(contenido: string): string {
    const regex = /import\s*\{([^}]*)\}\s*from\s*['"]typeorm['"];?/;
    const match = contenido.match(regex);
    if (!match) return contenido;
    const resto = contenido.replace(match[0], '');
    const todos = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    const usados = todos.filter((id) => new RegExp(`\\b${id}\\b`).test(resto));
    if (usados.length === todos.length) return contenido;
    if (usados.length === 0) {
        return contenido.replace(`${match[0]}\n`, '').replace(match[0], '');
    }
    return contenido.replace(match[0], `import { ${usados.join(', ')} } from 'typeorm';`);
}

/**
 * Quita el identificador de una entity de los imports si ya no se usa en el
 * cuerpo (p.ej. la relación hacia ella se eliminó). Si el import queda vacío,
 * se elimina la línea completa.
 */
function podarImportEntidad(content: string, className: string): string {
    const sinImports = content.replace(/^(import[^\n]*\n)/gm, '');
    if (new RegExp(`\\b${className}\\b`).test(sinImports)) return content; // aún se usa
    return content.replace(
        /^(import\s*\{([^}]*)\}\s*from\s*(['"][^'"]+['"]);?)$/gm,
        (linea, _todo, ids: string) => {
            const todos = ids.split(',').map((s) => s.trim()).filter(Boolean);
            if (!todos.includes(className)) return linea;
            const restantes = todos.filter((id) => id !== className);
            if (restantes.length === 0) return '';
            return `import { ${restantes.join(', ')} } from ${linea.match(/(['"][^'"]+['"])/)?.[1] ?? "''"};`;
        },
    );
}
