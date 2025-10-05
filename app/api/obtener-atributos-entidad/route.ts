import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { basePath, entityName } = await req.json();

    if (!basePath || !entityName) {
      return NextResponse.json(
        { error: "basePath y entityName son requeridos" },
        { status: 400 }
      );
    }

    // Construir la ruta del archivo de entidad
    const fileName = entityName.endsWith("Entity") 
      ? entityName.replace("Entity", "") 
      : entityName;
    
    const entityPath = path.join(
      basePath, 
      "src/persistence/entity", 
      `${fileName.toLowerCase()}.entity.ts`
    );

    if (!existsSync(entityPath)) {
      return NextResponse.json(
        { error: `No se encontró el archivo de entidad: ${fileName}.entity.ts` },
        { status: 404 }
      );
    }

    const content = readFileSync(entityPath, "utf-8");
    
    // Extraer atributos del archivo TypeScript
    const atributos = parseEntityAttributes(content);

    return NextResponse.json({ 
      entityName,
      atributos,
      content 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseEntityAttributes(content: string) {
  const atributos: any[] = [];
  const seenNames = new Set<string>();

  // Buscar propiedades de clase (sin decoradores en el regex, ya que están en líneas separadas)
  const propertyRegex = /(?:public|private|protected)?\s*(\w+)\s*:\s*(\w+(?:\[\])?)/g;

  let match;
  while ((match = propertyRegex.exec(content)) !== null) {
    const [, propertyName, propertyType] = match;

    // Evitar duplicados
    if (seenNames.has(propertyName)) continue;
    seenNames.add(propertyName);

    // Obtener decoradores para esta propiedad
    const decorators = extractDecorators(content, propertyName);

    // Solo procesar si tiene al menos un decorador (probablemente es una propiedad de entidad)
    if (decorators.length > 0) {
      const atributo: any = {
        nombreAtributo: propertyName,
        tipoDato: mapTypeScriptType(propertyType.replace(/\[\]/, '')), // Remover [] si es array
        nulo: false,
        unico: false,
      };

      // Procesar decoradores
      if (decorators.includes("Column") || decorators.includes("PrimaryGeneratedColumn") || decorators.includes("PrimaryColumn")) {
        const columnOptions = extractColumnOptions(content, propertyName);
        if (columnOptions.length) {
          atributo.length = columnOptions.length;
        }
        if (columnOptions.nullable !== undefined) {
          atributo.nulo = columnOptions.nullable;
        }
        if (columnOptions.unique !== undefined) {
          atributo.unico = columnOptions.unique;
        }
      }

      // Procesar relaciones
      const relationDecorator = decorators.find(d =>
        ["OneToOne", "OneToMany", "ManyToOne", "ManyToMany"].includes(d)
      );
      if (relationDecorator) {
        atributo.tipoDato = "relation";
        atributo.rEntity = propertyType.replace(/\[\]/, ''); // Remover [] para arrays
        atributo.tipoRelacion = relationDecorator;
      }

      // Procesar tipos numéricos
      if (propertyType.replace(/\[\]/, '') === "number") {
        const columnOptions = extractColumnOptions(content, propertyName);
        if (columnOptions.type === "int" || columnOptions.type === "integer") {
          atributo.integer = true;
        }
      }

      atributos.push(atributo);
    }
  }

  return atributos;
}

function extractDecorators(content: string, propertyName: string): string[] {
  const decorators: string[] = [];
  
  // Buscar la línea que contiene la propiedad
  const lines = content.split("\n");
  let propertyLineIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(propertyName) && lines[i].includes(":")) {
      propertyLineIndex = i;
      break;
    }
  }
  
  if (propertyLineIndex === -1) return decorators;
  
  // Buscar decoradores en las líneas anteriores
  for (let i = propertyLineIndex - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("@")) {
      const decoratorMatch = line.match(/@(\w+)/);
      if (decoratorMatch) {
        decorators.push(decoratorMatch[1]);
      }
    } else if (line === "" || line.startsWith("//")) {
      continue;
    } else {
      break;
    }
  }
  
  return decorators;
}

function extractColumnOptions(content: string, propertyName: string): any {
  const options: any = {};

  // Buscar la línea con la propiedad
  const lines = content.split("\n");
  let propertyLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(propertyName) && lines[i].includes(":")) {
      propertyLineIndex = i;
      break;
    }
  }

  if (propertyLineIndex === -1) return options;

  // Buscar decoradores de columna en las líneas anteriores
  for (let i = propertyLineIndex - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.includes("@Column") || line.includes("@PrimaryGeneratedColumn") || line.includes("@PrimaryColumn")) {
      // Extraer opciones del decorador
      const decoratorMatch = line.match(/@\w+\(([^)]*)\)/);
      if (decoratorMatch) {
        const optionsStr = decoratorMatch[1].trim();

        // Manejar sintaxis con {} y sin {}
        let parsedOptions = {};
        if (optionsStr.startsWith("{") && optionsStr.endsWith("}")) {
          // Sintaxis correcta: { length: 100, nullable: false }
          try {
            // Parsear manualmente las opciones
            parsedOptions = parseObjectOptions(optionsStr);
          } catch (e) {
            console.warn("Error parsing column options:", e);
          }
        } else {
          // Sintaxis de ejemplo: length: 100, nullable: false
          parsedOptions = parseSimpleOptions(optionsStr);
        }

        // Asignar opciones
        if (parsedOptions.length !== undefined) options.length = parsedOptions.length;
        if (parsedOptions.nullable !== undefined) options.nullable = parsedOptions.nullable;
        if (parsedOptions.unique !== undefined) options.unique = parsedOptions.unique;
        if (parsedOptions.type !== undefined) options.type = parsedOptions.type;
      }
      break;
    }
  }

  return options;
}

function parseObjectOptions(optionsStr: string): any {
  const options: any = {};
  // Remover { y }
  const content = optionsStr.slice(1, -1).trim();
  // Dividir por ,
  const pairs = content.split(",").map(p => p.trim());
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split(":").map(p => p.trim());
    const valueStr = valueParts.join(":").trim();
    if (key && valueStr) {
      if (valueStr === "true") options[key] = true;
      else if (valueStr === "false") options[key] = false;
      else if (/^\d+$/.test(valueStr)) options[key] = parseInt(valueStr);
      else if (valueStr.startsWith("'") || valueStr.startsWith('"')) {
        options[key] = valueStr.slice(1, -1);
      } else {
        options[key] = valueStr;
      }
    }
  }
  return options;
}

function parseSimpleOptions(optionsStr: string): any {
  const options: any = {};
  // Dividir por ,
  const pairs = optionsStr.split(",").map(p => p.trim());
  for (const pair of pairs) {
    const [key, valueStr] = pair.split(":").map(p => p.trim());
    if (key && valueStr) {
      if (valueStr === "true") options[key] = true;
      else if (valueStr === "false") options[key] = false;
      else if (/^\d+$/.test(valueStr)) options[key] = parseInt(valueStr);
      else if (valueStr.startsWith("'") || valueStr.startsWith('"')) {
        options[key] = valueStr.slice(1, -1);
      } else {
        options[key] = valueStr;
      }
    }
  }
  return options;
}

function mapTypeScriptType(tsType: string): string {
  const typeMap: { [key: string]: string } = {
    "string": "string",
    "number": "number",
    "boolean": "boolean",
    "Date": "Date",
    "Timestamp": "Timestamp",
    "Geometry": "Geometry",
  };
  
  return typeMap[tsType] || "string";
}