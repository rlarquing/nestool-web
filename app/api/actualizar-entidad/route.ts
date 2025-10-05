import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { basePath, entityName, atributos, esquema } = await req.json();

        if (!basePath || !entityName || !atributos) {
            return NextResponse.json(
                { error: 'basePath, entityName y atributos son requeridos' },
                { status: 400 }
            );
        }

        // Construir la ruta del archivo de entidad
        const fileName = entityName.endsWith('Entity') 
            ? entityName.replace('Entity', '') 
            : entityName;
        
        const entityPath = path.join(
            basePath, 
            'src/persistence/entity', 
            `${fileName.toLowerCase()}.entity.ts`
        );

        if (!existsSync(entityPath)) {
            return NextResponse.json(
                { error: `No se encontró el archivo de entidad: ${fileName}.entity.ts` },
                { status: 404 }
            );
        }

        // Leer el contenido actual
        const currentContent = readFileSync(entityPath, 'utf-8');
        
        // Generar nuevo contenido con los atributos actualizados
        const newContent = generateUpdatedEntityContent(currentContent, entityName, atributos, esquema);

        // Escribir el archivo actualizado
        writeFileSync(entityPath, newContent, 'utf-8');

        return NextResponse.json({ 
            success: true,
            message: `Entidad ${entityName} actualizada correctamente`,
            entityName,
            atributosCount: atributos.length
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function generateUpdatedEntityContent(currentContent: string, entityName: string, atributos: any[], esquema?: string): string {
    // Extraer imports existentes
    const imports = extractImports(currentContent);
    
    // Generar imports necesarios para los nuevos atributos
    const newImports = generateImportsForAttributes(atributos);
    const allImports = [...new Set([...imports, ...newImports])];
    
    // Generar código de atributos
    const atributosCode = generateAttributesCode(atributos);
    
    // Generar parámetros del constructor
    const parametrosConstructor = generateConstructorParameters(atributos);
    
    // Generar asignaciones del constructor
    const thisAtributos = generateConstructorAssignments(atributos);
    
    // Obtener el nombre de la clase
    const className = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
    
    // Construir el nuevo contenido
    const importSection = allImports.length > 0 ? allImports.join('\n') + '\n\n' : '';
    
    // Extraer el decorador @Entity existente y actualizarlo si es necesario
    const entityDecorator = generateEntityDecorator(entityName, esquema);
    
    const newContent = `${importSection}${entityDecorator}
export class ${className} extends GenericEntity {

    ${atributosCode}

    constructor(${parametrosConstructor}) {
        super();
        ${thisAtributos}
    }

   public toString(): string {
        return '';
    }
}`;

    return newContent;
}

function extractImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
        if (line.trim().startsWith('import ')) {
            imports.push(line.trim());
        }
    }
    
    return imports;
}

function generateImportsForAttributes(atributos: any[]): string[] {
    const imports: string[] = [];
    const typeormImports = new Set<string>();
    
    // Importaciones básicas de TypeORM
    typeormImports.add('Column');
    typeormImports.add('Entity');
    
    for (const attr of atributos) {
        if (attr.tipoDato === 'relation') {
            // Agregar importaciones de relaciones
            if (attr.tipoRelacion === 'OneToOne') {
                typeormImports.add('OneToOne');
                typeormImports.add('JoinColumn');
            } else if (attr.tipoRelacion === 'OneToMany') {
                typeormImports.add('OneToMany');
            } else if (attr.tipoRelacion === 'ManyToOne') {
                typeormImports.add('ManyToOne');
                typeormImports.add('JoinColumn');
            } else if (attr.tipoRelacion === 'ManyToMany') {
                typeormImports.add('ManyToMany');
                typeormImports.add('JoinTable');
            }
            
            // Agregar importación de la entidad relacionada
            if (attr.rEntity) {
                imports.push(`import { ${attr.rEntity} } from './${attr.rEntity.toLowerCase().replace('entity', '')}.entity';`);
            }
        }
    }
    
    // Agregar importación de TypeORM
    if (typeormImports.size > 0) {
        imports.unshift(`import { ${Array.from(typeormImports).join(', ')} } from "typeorm";`);
    }
    
    // Agregar importaciones básicas
    imports.unshift(`import { GenericEntity } from "./generic.entity";`);
    imports.unshift(`import { SchemaEnum } from '../../database/schema/schema.enum';`);
    
    return imports;
}

function generateAttributesCode(atributos: any[]): string {
    return atributos.map(attr => {
        let code = '';
        
        if (attr.tipoDato === 'relation') {
            // Generar decoradores de relación
            if (attr.tipoRelacion === 'OneToOne') {
                code += `    @OneToOne(() => ${attr.rEntity}, { nullable: ${attr.nulo} })\n`;
                code += `    @JoinColumn()\n`;
            } else if (attr.tipoRelacion === 'OneToMany') {
                code += `    @OneToMany(() => ${attr.rEntity}, ${attr.nombreAtributo} => ${attr.nombreAtributo}.${getInverseProperty(attr)})\n`;
            } else if (attr.tipoRelacion === 'ManyToOne') {
                code += `    @ManyToOne(() => ${attr.rEntity}, { nullable: ${attr.nulo} })\n`;
                code += `    @JoinColumn()\n`;
            } else if (attr.tipoRelacion === 'ManyToMany') {
                code += `    @ManyToMany(() => ${attr.rEntity})\n`;
                code += `    @JoinTable()\n`;
            }
        } else {
            // Generar decorador @Column
            const columnOptions = [];
            if (attr.length) columnOptions.push(`length: ${attr.length}`);
            if (attr.nulo) columnOptions.push('nullable: true');
            if (attr.unico) columnOptions.push('unique: true');
            if (attr.tipoDato === 'number' && attr.integer) columnOptions.push('type: "int"');
            
            const optionsStr = columnOptions.length > 0 ? `{ ${columnOptions.join(', ')} }` : '';
            code += `    @Column(${optionsStr})\n`;
        }
        
        // Agregar la declaración de la propiedad
        code += `    ${attr.nombreAtributo}: ${getTypeScriptType(attr.tipoDato, attr.rEntity)};`;
        
        return code;
    }).join('\n\n    ');
}

function generateConstructorParameters(atributos: any[]): string {
    return atributos.map(attr => {
        const type = getTypeScriptType(attr.tipoDato, attr.rEntity);
        return `${attr.nombreAtributo}: ${type}`;
    }).join(', ');
}

function generateConstructorAssignments(atributos: any[]): string {
    return atributos.map(attr => `this.${attr.nombreAtributo} = ${attr.nombreAtributo};`).join('\n        ');
}

function generateEntityDecorator(entityName: string, esquema?: string): string {
    const tableName = entityName.toLowerCase().replace('entity', '');
    
    if (esquema) {
        return `@Entity('${tableName}', { schema: SchemaEnum.${esquema} })`;
    } else {
        return `@Entity('${tableName}')`;
    }
}

function getTypeScriptType(tipoDato: string, rEntity?: string): string {
    const typeMap: { [key: string]: string } = {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
        'Date': 'Date',
        'Timestamp': 'Date',
        'Geometry': 'any',
        'relation': rEntity || 'any'
    };
    
    return typeMap[tipoDato] || 'string';
}

function getInverseProperty(attr: any): string {
    // Esta función debería determinar la propiedad inversa basada en la relación
    // Por simplicidad, retornamos un valor por defecto
    return 'id';
}
