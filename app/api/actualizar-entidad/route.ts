import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula, pluralizarEntidad } from '@/utilities/entity-utils';
import { sincronizarAtributosEntity, type AtributoEntrada, type DetalleCambio } from '@/utilities/entidad-sync';
import { inyectarRelacionInversa, eliminarRelacionInversa } from '@/utilities/relacion-inversa';

interface CuerpoPeticion {
    basePath: string;
    entityName: string;
    atributos: AtributoEntrada[];
    esquema?: string;
    databaseType?: string;
}

/** Extrae el miembro `SchemaEnum.X` del decorador @Entity actual (sin tocarlo: F2-C4/C5). */
function esquemaActual(content: string): string | null {
    const match = content.match(/schema:\s*SchemaEnum\.([A-Za-z0-9_]+)/);
    return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
    try {
        const { basePath, entityName, atributos, esquema, databaseType } = await req.json() as CuerpoPeticion;

        if (!basePath || !entityName || !Array.isArray(atributos)) {
            return NextResponse.json(
                { error: 'basePath, entityName y atributos son requeridos' },
                { status: 400 }
            );
        }

        // La clase exportada SIEMPRE termina en Entity (así la crea crear-entidad)
        const className = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const nombreBase = eliminarSufijo(className, 'Entity');

        // F2-C7: ruta kebab real (antes fileName.toLowerCase() → 404 para multi-palabra)
        const kebab = formatearNombre(nombreBase, '-');
        const entityPath = path.join(basePath, 'src/persistence/entity', `${kebab}.entity.ts`);

        if (!existsSync(entityPath)) {
            return NextResponse.json(
                { error: `No se encontró el archivo de entidad: ${kebab}.entity.ts` },
                { status: 404 }
            );
        }

        // Nombres duplicados en la petición → rechazar antes de tocar nada
        const vistos = new Set<string>();
        for (const attr of atributos) {
            if (!attr?.nombreAtributo || !attr?.tipoDato) {
                return NextResponse.json(
                    { error: 'Todos los atributos deben tener nombre y tipo de dato' },
                    { status: 400 }
                );
            }
            if (vistos.has(attr.nombreAtributo)) {
                return NextResponse.json(
                    { error: `Atributo duplicado en la petición: ${attr.nombreAtributo}` },
                    { status: 400 }
                );
            }
            vistos.add(attr.nombreAtributo);
        }

        const currentContent = readFileSync(entityPath, 'utf-8');

        // F2-C4/C5: el decorador @Entity (tabla, schema, índices), la herencia y
        // todo el código propio NO se regeneran jamás. Si piden otro esquema, se avisa.
        const avisos: string[] = [];
        const esquemaEnFichero = esquemaActual(currentContent);
        if (esquema && esquemaEnFichero && esquema.toString().toUpperCase() !== esquemaEnFichero) {
            avisos.push(`El esquema de una entity existente no se modifica por seguridad (edición quirúrgica): sigue siendo SchemaEnum.${esquemaEnFichero}. Cámbialo a mano si de verdad necesitas migrarla de schema.`);
        }
        const esquemaParaDestinos = (esquemaEnFichero ?? (esquema ? esquema.toString().toUpperCase() : 'PUBLIC'));

        // Diff quirúrgico: añade lo nuevo, elimina lo ausente, no re-emite lo existente
        let resultado;
        try {
            resultado = sincronizarAtributosEntity({
                contenido: currentContent,
                className,
                deseados: atributos,
                databaseType,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Fichero no parseable / clase inesperada: NUNCA se toca
            return NextResponse.json({ error: message }, { status: 422 });
        }
        avisos.push(...resultado.avisos);

        // Relaciones añadidas → inyectar la inversa en la entity destino (mismo
        // mecanismo con anclas idempotentes que crear-entidad)
        for (const agr of resultado.agregados) {
            if (agr.tipoDato !== 'relation' || !agr.rEntity) continue;
            const tipoRelacion = agr.tipoRelacion ?? 'ManyToOne';
            const coleccionInversa = tipoRelacion === 'OneToOne'
                ? aInicialMinuscula(nombreBase)
                : pluralizarEntidad(className);
            const inyeccion = inyectarRelacionInversa(basePath, {
                tipoRelacion,
                nombreAtributo: agr.nombreAtributo,
                entidadOrigen: className,
                entidadDestino: agr.rEntity,
                coleccionInversa,
                nombreInversa: aInicialMinuscula(nombreBase),
                requerido: agr.nulo !== true,
            }, { esquema: esquemaParaDestinos });
            avisos.push(...inyeccion.avisos);
        }

        // Relaciones eliminadas → retirar la inversa anclada en la entity destino
        for (const eli of resultado.eliminados) {
            if (eli.tipoDato !== 'relation') continue;
            const limpieza = eliminarRelacionInversa(basePath, className, eli.nombreAtributo);
            avisos.push(...limpieza.avisos);
            if (!limpieza.eliminado) {
                avisos.push(`Si ${eli.rEntity} tenía una inversa escrita a mano hacia "${eli.nombreAtributo}", quítala a mano (nestool no toca bloques sin su ancla).`);
            }
        }

        // Guardar solo si cambió (idempotencia real)
        let escrito = false;
        if (resultado.cambio && resultado.contenido !== currentContent) {
            const { writeFileSync } = await import('fs');
            writeFileSync(entityPath, resultado.contenido, 'utf-8');
            escrito = true;
        }

        const partes: string[] = [];
        if (resultado.agregados.length) partes.push(`+${resultado.agregados.length} añadido(s)`);
        if (resultado.eliminados.length) partes.push(`-${resultado.eliminados.length} eliminado(s)`);
        partes.push(`${resultado.sinCambios.length} sin cambios`);
        if (!escrito) partes.push('fichero intacto');

        return NextResponse.json({
            success: true,
            message: escrito
                ? `Entity ${className} editada quirúrgicamente: ${partes.join(', ')}`
                : `Entity ${className} sin cambios que aplicar (${partes.join(', ')})`,
            entityName: className,
            filePath: entityPath,
            escrito,
            agregados: resultado.agregados,
            eliminados: resultado.eliminados,
            sinCambios: resultado.sinCambios,
            avisos,
            atributosCount: atributos.length,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: `Error al actualizar la entidad: ${message}` }, { status: 500 });
    }
}

/** Tipo expuesto para el hook del frontend. */
export type ActualizarEntidadDetalle = DetalleCambio;
