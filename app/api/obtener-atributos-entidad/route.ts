import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { formatearNombre, eliminarSufijo } from "@/utilities/entity-utils";
import { parseEntityContent, type ColumnaEntity, type RelacionEntity } from "@/utilities/entity-parser";

/**
 * Carga los atributos de una entity para el flujo "Editar entity".
 * F2-C6: usa el parser robusto compartido. El parser legacy de una línea
 * ignoraba las propiedades con `!` (requeridas): la UI mostraba una lista
 * incompleta y al guardar la entity se habrían ELIMINADO esos atributos.
 * F2-C7: ruta kebab-case real (antes fileName.toLowerCase() → 404 multi-palabra).
 */
export async function POST(req: NextRequest) {
  try {
    const { basePath, entityName } = await req.json();

    if (!basePath || !entityName) {
      return NextResponse.json(
        { error: "basePath y entityName son requeridos" },
        { status: 400 }
      );
    }

    const className = entityName.endsWith("Entity") ? entityName : entityName + "Entity";
    const nombreBase = eliminarSufijo(className, "Entity");
    const kebab = formatearNombre(nombreBase, "-");

    const entityPath = path.join(
      basePath,
      "src/persistence/entity",
      `${kebab}.entity.ts`
    );

    if (!existsSync(entityPath)) {
      return NextResponse.json(
        { error: `No se encontró el archivo de entidad: ${kebab}.entity.ts` },
        { status: 404 }
      );
    }

    const content = readFileSync(entityPath, "utf-8");
    const info = parseEntityContent(content);
    if (!info) {
      return NextResponse.json(
        { error: `La entity ${className} no se pudo parsear (fichero sin clase válida): el editor no puede cargarla sin riesgo de destruirla.` },
        { status: 422 }
      );
    }

    // Mapa del parser → modelo del formulario (round-trip fiel en NOMBRES;
    // las opciones existentes no se re-emiten al guardar, así que una carga
    // lossy en opciones es inocua).
    const atributos = info.atributos.map((a) => {
      if (a.tipo === "relacion") {
        const r = a as RelacionEntity;
        return {
          nombreAtributo: r.nombre,
          tipoDato: "relation",
          rEntity: r.destino,
          tipoRelacion: r.tipoRelacion,
          nulo: r.opcional,
          unico: false,
        };
      }
      const c = a as ColumnaEntity;
      return {
        nombreAtributo: c.nombre,
        tipoDato: c.tipoTs,
        nulo: c.opcional,
        unico: c.esUnica,
        ...(c.length !== undefined ? { length: c.length } : {}),
        ...(c.esInteger ? { integer: true } : {}),
      };
    });

    return NextResponse.json({
      entityName: className,
      atributos,
      content,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
