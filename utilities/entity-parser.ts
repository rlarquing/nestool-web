// Parser robusto de ficheros .entity.ts del estilo api-base.
// Reemplaza los regex frágiles de una línea: soporta decoradores multi-línea,
// paréntesis anidados (default: now()), strings con ')' y comentarios.
// Fuente única para crear-mapper y crear-repository (F6-C3 / F7-M1).
import { existsSync, readFileSync } from 'fs';

export interface ColumnaEntity {
    tipo: 'columna';
    nombre: string;
    tipoTs: string; // 'string' | 'number' | 'Date' | 'boolean' | ...
    opcional: boolean;
    esUnica: boolean;
    length?: number;      // length: N del @Column (varchar)
    esInteger?: boolean;  // type: 'int' | 'integer' del @Column
}

export interface RelacionEntity {
    tipo: 'relacion';
    nombre: string;
    tipoRelacion: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
    destino: string; // clase de la entity relacionada (p.ej. MenuEntity)
    opcional: boolean;
}

export type AtributoEntity = ColumnaEntity | RelacionEntity;

export interface EntityInfo {
    clase: string;
    atributos: AtributoEntity[]; // en orden de declaración
    columnas: ColumnaEntity[];
    relaciones: RelacionEntity[];
}

const RELACIONES = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'];
const DECORADORES_COLUMNA = ['Column', 'PrimaryColumn', 'PrimaryGeneratedColumn', 'CreateDateColumn', 'UpdateDateColumn'];

const regexPropiedad = /^(readonly\s+)?([A-Za-z_$][\w$]*)(\?)?(!)?:\s*([^=;]+?);?\s*$/;

/** Elimina comentarios // y /* ... *​/ respetando strings y template literals. */
function quitarComentarios(content: string): string {
    let out = '';
    let i = 0;
    let comilla: '"' | "'" | '`' | null = null;
    while (i < content.length) {
        const c = content[i];
        const siguiente = content[i + 1];
        if (comilla) {
            out += c;
            if (c === '\\') {
                out += siguiente ?? '';
                i += 2;
                continue;
            }
            if (c === comilla) comilla = null;
            i++;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            comilla = c;
            out += c;
            i++;
            continue;
        }
        if (c === '/' && siguiente === '/') {
            while (i < content.length && content[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && siguiente === '*') {
            i += 2;
            while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/**
 * Desde el índice de un '(' devuelve el índice de su ')' correspondiente,
 * respetando strings y template literals. Devuelve -1 si no cierra.
 */
function encontrarCierreParen(texto: string, inicio: number): number {
    let balance = 0;
    let comilla: '"' | "'" | '`' | null = null;
    for (let i = inicio; i < texto.length; i++) {
        const c = texto[i];
        if (comilla) {
            if (c === '\\') {
                i++;
                continue;
            }
            if (c === comilla) comilla = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            comilla = c;
            continue;
        }
        if (c === '(') balance++;
        else if (c === ')') {
            balance--;
            if (balance === 0) return i;
        }
    }
    return -1;
}

/** Extrae el cuerpo de la clase (entre llaves balanceadas) o null si está roto. */
function extraerCuerpoClase(content: string, cabeceraClase: string): string | null {
    const inicioClase = content.indexOf(cabeceraClase);
    if (inicioClase === -1) return null;
    const aperturaLlave = content.indexOf('{', inicioClase);
    if (aperturaLlave === -1) return null;
    let balance = 0;
    let comilla: '"' | "'" | '`' | null = null;
    for (let i = aperturaLlave; i < content.length; i++) {
        const c = content[i];
        if (comilla) {
            if (c === '\\') {
                i++;
                continue;
            }
            if (c === comilla) comilla = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') comilla = c;
        else if (c === '{') balance++;
        else if (c === '}') {
            balance--;
            if (balance === 0) return content.slice(aperturaLlave + 1, i);
        }
    }
    return null; // llaves sin cerrar: fichero roto
}

/**
 * Parsea el contenido de un fichero .entity.ts. Devuelve null si no encuentra
 * una clase bien formada (fichero corrupto o no parseable): el llamador nunca
 * debe tocar un fichero que no parsea.
 */
export function parseEntityContent(content: string): EntityInfo | null {
    const limpio = quitarComentarios(content);
    const claseMatch = limpio.match(/export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/);
    if (!claseMatch) return null;
    const cuerpo = extraerCuerpoClase(limpio, claseMatch[0]);
    if (cuerpo === null) return null;

    const atributos: AtributoEntity[] = [];
    const lineas = cuerpo.split('\n');
    let i = 0;
    while (i < lineas.length) {
        if (!lineas[i].trim().startsWith('@')) {
            i++;
            continue;
        }
        const siguiente = procesarBloqueDecoradores(lineas, i, atributos);
        if (siguiente === null) return null; // decorador sin cerrar: fichero roto
        i = siguiente <= i ? i + 1 : siguiente; // garantía de progreso (nunca colgar)
    }

    return {
        clase: claseMatch[1],
        atributos,
        columnas: atributos.filter((a): a is ColumnaEntity => a.tipo === 'columna'),
        relaciones: atributos.filter((a): a is RelacionEntity => a.tipo === 'relacion'),
    };
}

/**
 * Procesa una secuencia de decoradores apilados + su declaración de propiedad.
 * Devuelve el índice de la línea siguiente al atributo, o null si hay un
 * paréntesis sin cerrar (fichero roto).
 */
function procesarBloqueDecoradores(lineas: string[], inicio: number, atributos: AtributoEntity[]): number | null {
    let i = inicio;
    let decoradorTipo = ''; // 'Column' | OneToOne | OneToMany | ManyToOne | ManyToMany | '' (otro)
    let destinoRelacion = '';
    let esUnica = false;
    let lengthActual: number | null = null;
    let esIntegerActual = false;

    // 1) Consumir todos los decoradores apilados.
    while (true) {
        const lineaActual = (lineas[i] ?? '').trim();
        if (!lineaActual.startsWith('@')) break;
        const textoRestante = lineas.slice(i).join('\n');
        // ^\s*@ : los decoradores dentro de la clase van indentados
        const matchDecorador = textoRestante.match(/^\s*@([A-Za-z_$][\w$]*)\s*\(/);
        if (!matchDecorador) break;
        const aperturaRelativa = matchDecorador[0].length - 1;
        const cierreRelativo = encontrarCierreParen(textoRestante, aperturaRelativa);
        if (cierreRelativo === -1) return null;
        const bloque = textoRestante.slice(0, cierreRelativo + 1);
        const nombre = matchDecorador[1];
        if (RELACIONES.includes(nombre)) {
            decoradorTipo = nombre;
            const destinoMatch = bloque.match(/\(\s*\(\s*\)\s*=>\s*([A-Za-z_$][\w$]*)/);
            if (destinoMatch) destinoRelacion = destinoMatch[1];
        } else if (DECORADORES_COLUMNA.includes(nombre)) {
            decoradorTipo = 'Column';
        }
        if (/unique:\s*true/.test(bloque)) esUnica = true;
        const lengthMatch = bloque.match(/\blength:\s*(\d+)/);
        if (lengthMatch) lengthActual = parseInt(lengthMatch[1], 10);
        if (/type:\s*['"](?:int|integer)['"]/.test(bloque)) esIntegerActual = true;

        i += bloque.split('\n').length;
        // ¿La propiedad está en la MISMA línea que el paréntesis de cierre?
        const mismaLinea = textoRestante.slice(cierreRelativo + 1).split('\n')[0].trim();
        if (mismaLinea) {
            if (mismaLinea.startsWith('@')) continue; // decorador apilado en la misma línea
            const matchPropiedad = mismaLinea.match(regexPropiedad);
            if (!matchPropiedad) break; // algo inesperado: abortar el bloque
            emitirAtributo(atributos, decoradorTipo, destinoRelacion, esUnica, lengthActual, esIntegerActual, matchPropiedad);
            return i;
        }
    }

    // 2) Buscar la declaración de propiedad en las líneas siguientes (sin blancos).
    for (let j = i; j < lineas.length; j++) {
        const candidata = lineas[j].trim();
        if (!candidata) continue;
        if (candidata.startsWith('@')) break; // otro decorador sin propiedad: abortar
        const matchPropiedad = candidata.match(regexPropiedad);
        if (!matchPropiedad) break; // constructor / método / otra cosa
        emitirAtributo(atributos, decoradorTipo, destinoRelacion, esUnica, lengthActual, esIntegerActual, matchPropiedad);
        return j + 1;
    }
    return i;
}

function emitirAtributo(
    atributos: AtributoEntity[],
    decoradorTipo: string,
    destinoRelacion: string,
    esUnica: boolean,
    length: number | null,
    esInteger: boolean,
    matchPropiedad: RegExpMatchArray,
): void {
    const nombre = matchPropiedad[2];
    const opcional = Boolean(matchPropiedad[3]);
    const tipoTs = matchPropiedad[5].trim().replace(/\s*\|\s*null\s*$/, '').trim();
    if (decoradorTipo === 'Column') {
        atributos.push({
            tipo: 'columna',
            nombre,
            tipoTs,
            opcional,
            esUnica,
            ...(length !== null ? { length } : {}),
            ...(esInteger ? { esInteger: true } : {}),
        });
    } else if (decoradorTipo && RELACIONES.includes(decoradorTipo)) {
        atributos.push({
            tipo: 'relacion',
            nombre,
            tipoRelacion: decoradorTipo as RelacionEntity['tipoRelacion'],
            destino: destinoRelacion,
            opcional,
        });
    }
    // decoradorTipo === '' → decorador no reconocido: ignorar el atributo.
}

/** Lee y parsea un fichero de entidad; lanza un error descriptivo si no existe o no parsea. */
export function cargarEntity(entityPath: string, nombreEsperado: string): EntityInfo {
    if (!existsSync(entityPath)) {
        throw new Error(`La entity ${nombreEsperado} no existe en ${entityPath}. Créala primero (función "Nueva entity").`);
    }
    const contenido = readFileSync(entityPath, 'utf-8');
    const info = parseEntityContent(contenido);
    if (!info) {
        throw new Error(`La entity ${nombreEsperado} (${entityPath}) no se pudo parsear: el fichero no contiene una clase válida.`);
    }
    return info;
}
