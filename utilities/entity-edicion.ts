// Utilidades de edición quirúrgica de ficheros .entity.ts existentes (F1-C4).
// Reglas: nunca tocar un fichero que no se reconoce como clase; inserciones
// idempotentes mediante anclas; nada de reescribir el fichero completo.
import { existsSync, readFileSync, writeFileSync } from 'fs';

/** Indica si el contenido declara `export class <className>`. */
export function claseExiste(content: string, className: string): boolean {
    const regex = new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${className}\\b`);
    return regex.test(content);
}

/** Lee un fichero y devuelve su contenido solo si declara la clase pedida. */
export function leerClase(filePath: string, className: string): string | null {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf-8');
    if (!claseExiste(content, className)) return null; // no parseable / clase inesperada: no tocar
    return content;
}

/**
 * Inserta un miembro (decoradores + propiedad) al inicio del cuerpo de la clase,
 * al estilo api-base (las relaciones van primero). Devuelve el contenido nuevo
 * o null si no encuentra una clase bien formada.
 */
export function insertarMiembroEnClase(content: string, snippet: string): string | null {
    const matchClase = content.match(/export\s+(?:abstract\s+)?class\s+[A-Za-z_$][\w$]*[^\{]*\{/);
    if (!matchClase) return null;
    const apertura = (matchClase.index ?? 0) + matchClase[0].length;
    return `${content.slice(0, apertura)}\n\n    ${snippet}\n${content.slice(apertura)}`;
}

/** Añade una línea de import después del último import existente (o al principio). */
export function agregarImportAContent(content: string, importLine: string): string {
    const lineas = content.split('\n');
    let ultimoImport = -1;
    for (let i = 0; i < lineas.length; i++) {
        if (/^\s*import\s/.test(lineas[i])) ultimoImport = i;
    }
    if (ultimoImport === -1) return `${importLine}\n${content}`;
    lineas.splice(ultimoImport + 1, 0, importLine);
    return lineas.join('\n');
}

/**
 * Fusiona los identificadores pedidos en el import multi-nombre de 'typeorm'.
 * Si no existe el import, lo crea al principio del fichero.
 */
export function fusionarImportsTypeorm(content: string, pedidos: string[]): string {
    const regex = /import\s*\{([^}]*)\}\s*from\s*['"]typeorm['"];?/;
    const match = content.match(regex);
    if (match) {
        const actuales = match[1].split(',').map((s) => s.trim()).filter(Boolean);
        const todos = Array.from(new Set([...actuales, ...pedidos])).sort();
        return content.replace(regex, `import { ${todos.join(', ')} } from 'typeorm';`);
    }
    const todos = Array.from(new Set(pedidos)).sort();
    return agregarImportAContent(content, `import { ${todos.join(', ')} } from 'typeorm';`);
}

/** Guarda solo si el contenido cambió (evita reescrituras innecesarias). */
export function escribirSiCambia(filePath: string, content: string): boolean {
    if (existsSync(filePath)) {
        const previo = readFileSync(filePath, 'utf-8');
        if (previo === content) return false;
    }
    writeFileSync(filePath, content);
    return true;
}
