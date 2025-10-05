import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, generarColumna, generarRelacion } from '@/utilities/entity-utils';
import { genericEntity } from '@/template/entity.template';
import * as manyToOneTemplate from '@/template/many-to-one.template';
import * as oneToManyTemplate from '@/template/one-to-many.template';
import * as oneToOneTemplate from '@/template/one-to-one.template';
import * as manyToManyTemplate from '@/template/many-to-many.template';

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

        // Procesar atributos y generar código
        let importaciones: string[] = [];
        const atributosCode: string[] = [];
        let typeormImports: string[] = ['Column', 'Entity'];
        const parametrosConstructor: string[] = [];
        const thisAtributos: string[] = [];

        // Procesar cada atributo
        for (const atributo of atributos) {
            if (atributo.tipoDato === 'relation') {
                // Agregar imports necesarios para relaciones
                if (atributo.tipoRelacion === 'OneToOne' || atributo.tipoRelacion === 'ManyToOne') {
                    typeormImports.push('JoinColumn');
                }
                if (atributo.tipoRelacion === 'ManyToMany') {
                    typeormImports.push('JoinTable');
                }
                typeormImports.push(atributo.tipoRelacion);

                // Agregar import de la entidad relacionada
                const nombreArchivo = formatearNombre(eliminarSufijo(atributo.rEntity, 'Entity'), '-');
                importaciones.push(`import { ${atributo.rEntity} } from './${nombreArchivo}.entity';`);

                // Generar código de relación
                atributosCode.push(generarRelacion(atributo));

                // Agregar parámetro al constructor
                const tipoParametro = atributo.tipoRelacion === 'OneToMany' || atributo.tipoRelacion === 'ManyToMany' 
                    ? `${atributo.rEntity}[]` 
                    : atributo.rEntity;
                parametrosConstructor.push(`${atributo.nombreAtributo}: ${tipoParametro}`);
                thisAtributos.push(`this.${atributo.nombreAtributo} = ${atributo.nombreAtributo};`);

                // --- NUEVO: Generar relación inversa en la entidad destino ---
                try {
                    // Definir nombres y paths
                    const destinoEntityName = atributo.rEntity;
                    const destinoFileName = `${formatearNombre(eliminarSufijo(destinoEntityName, 'Entity'), '-')}.entity.ts`;
                    const destinoFilePath = path.join(basePath, 'src/persistence/entity', destinoFileName);
                    const origenEntityName = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
                    const origenFileName = `${formatearNombre(eliminarSufijo(origenEntityName, 'Entity'), '-')}.entity.ts`;
                    // Leer o crear el archivo de la entidad destino
                    let destinoContent = '';
                    let destinoClassBody = '';
                    let destinoImports = '';
                    let destinoAlreadyHasImport = false;
                    let destinoAlreadyHasRelation = false;
                    if (existsSync(destinoFilePath)) {
                        destinoContent = readFileSync(destinoFilePath, 'utf-8');
                        destinoAlreadyHasImport = destinoContent.includes(origenEntityName);
                        destinoAlreadyHasRelation = destinoContent.includes(`@`); // Simple check, mejorar si es necesario
                    } else {
                        // Crear archivo base si no existe
                        destinoContent = `import { Entity } from 'typeorm';\n@Entity('${formatearNombre(eliminarSufijo(destinoEntityName, 'Entity'), '_')}')\nexport class ${destinoEntityName} {\n\n}`;
                    }
                    // Determinar el tipo de relación inversa y el nombre del atributo
                    let inversaDecorador = '';
                    let inversaAtributo = '';
                    let inversaImport = `import { ${origenEntityName} } from './${formatearNombre(eliminarSufijo(origenEntityName, 'Entity'), '-')}.entity';`;
                    let inversaTypeormImports = '';
                    // Pluralizar el nombre del atributo si es necesario
                    const pluralize = (str: string) => str.endsWith('s') ? str : str + 's';
                    const lowerOrigen = origenEntityName.charAt(0).toLowerCase() + origenEntityName.slice(1);
                    switch (atributo.tipoRelacion) {
                        case 'ManyToOne':
                            // Inversa: OneToMany
                            inversaDecorador = oneToManyTemplate.destino.replace('$entity', origenEntityName)
                                .replace('($name)', `(${lowerOrigen})`)
                                .replace('$nAtributo', atributo.nombreAtributo)
                                .replace('$atributo', `${pluralize(atributo.nombreAtributo)}: ${origenEntityName}[];`);
                            inversaTypeormImports = 'OneToMany';
                            break;
                        case 'OneToMany':
                            // Inversa: ManyToOne
                            inversaDecorador = manyToOneTemplate.origen.replace('$entity', origenEntityName)
                                .replace('($name)', `(${lowerOrigen})`)
                                .replace('$nAtributos', pluralize(atributo.nombreAtributo))
                                .replace('$atributo', `${atributo.nombreAtributo}: ${origenEntityName};`);
                            inversaTypeormImports = 'ManyToOne, JoinColumn';
                            break;
                        case 'OneToOne':
                            // Inversa: OneToOne
                            inversaDecorador = oneToOneTemplate.origen.replace('$entity', origenEntityName)
                                .replace('($name)', `(${lowerOrigen})`)
                                .replace('$atributo', `${atributo.nombreAtributo}: ${origenEntityName};`);
                            inversaTypeormImports = 'OneToOne, JoinColumn';
                            break;
                        case 'ManyToMany':
                            // Inversa: ManyToMany (sin JoinTable)
                            inversaDecorador = manyToManyTemplate.destino.replace('$entity', origenEntityName)
                                .replace('($entidad)', `(${lowerOrigen})`)
                                .replace('$nAtributo', atributo.nombreAtributo)
                                .replace('$atributo', `${pluralize(atributo.nombreAtributo)}: ${origenEntityName}[];`);
                            inversaTypeormImports = 'ManyToMany, JoinColumn';
                            break;
                        default:
                            break;
                    }
                    // Insertar import si no existe
                    if (!destinoAlreadyHasImport && !destinoContent.includes(inversaImport)) {
                        destinoContent = destinoContent.replace(/(import [^;]+;\n)/, `$1${inversaImport}\n`);
                    }
                    // Insertar decorador y atributo si no existe
                    if (!destinoAlreadyHasRelation || !destinoContent.includes(inversaDecorador.trim())) {
                        // Insertar antes del constructor o al final de la clase
                        destinoContent = destinoContent.replace(/(constructor\([^)]*\) {[^}]*})/, `${inversaDecorador}\n    $1`);
                        if (!/constructor\(/.test(destinoContent)) {
                            destinoContent = destinoContent.replace(/(}\s*)$/, `    ${inversaDecorador}\n$1`);
                        }
                    }
                    // Insertar import de typeorm si no existe
                    if (!destinoContent.includes(inversaTypeormImports)) {
                        destinoContent = destinoContent.replace(/import {([^}]*)} from 'typeorm';/, (match, p1) => {
                            const imports = p1.split(',').map((i: string) => i.trim());
                            const newImports = inversaTypeormImports.split(',').map((i: string) => i.trim());
                            const allImports = Array.from(new Set([...imports, ...newImports]));
                            return `import { ${allImports.join(', ')} } from 'typeorm';`;
                        });
                    }
                    // Guardar archivo actualizado
                    writeFileSync(destinoFilePath, destinoContent);
                } catch (e) {
                    // Si falla la actualización de la entidad destino, continuar
                }
            } else {
                // Generar columna normal
                atributosCode.push(generarColumna(atributo, databaseType));
                parametrosConstructor.push(`${atributo.nombreAtributo}: ${atributo.tipoDato}`);
                thisAtributos.push(`this.${atributo.nombreAtributo} = ${atributo.nombreAtributo};`);
            }
        }

        // Eliminar duplicados
        typeormImports = [...new Set(typeormImports)];
        importaciones = [...new Set(importaciones)];
        
        // Asegurar que no haya duplicados en el string final
        const uniqueTypeormImports = typeormImports.filter((item, index) => typeormImports.indexOf(item) === index);

        // Preparar el template
        // El nombre de la clase y export SIEMPRE termina en Entity
        const className = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        let template = genericEntity;
        template = template.replace('$typeorm', uniqueTypeormImports.join(', '));
        template = template.replace('$entidad', formatearNombre(eliminarSufijo(entityName, 'Entity'), '_'));
        // Si la base de datos es postgres, usar schema, si no, quitarlo
        let entityDecorator = '';
        if ((databaseType || '').toLowerCase() === 'postgresql' || (databaseType || '').toLowerCase() === 'postgres') {
            entityDecorator = `@Entity('${formatearNombre(eliminarSufijo(entityName, 'Entity'), '_')}', { schema: SchemaEnum.${esquema || 'public'} })`;
        } else {
            entityDecorator = `@Entity('${formatearNombre(eliminarSufijo(entityName, 'Entity'), '_')}')`;
        }
        template = template.replace('@Entity(\'$entidad\', { schema: SchemaEnum.$schema })', entityDecorator);
        template = template.replace('$schema', esquema || 'public');
        template = template.replace('$atributos', atributosCode.join('\n\n    '));
        template = template.replace('$parametros', parametrosConstructor.join(', '));
        template = template.replace('$thisAtributos', thisAtributos.join('\n        '));
        template = template.replace('$nameEntity', className);
        template = template.replace('$import', importaciones.join('\n'));

        // Crear directorio si no existe
        const entityDir = path.join(basePath, 'src/persistence/entity');
        if (!existsSync(entityDir)) {
            mkdirSync(entityDir, { recursive: true });
        }

        // Escribir archivo de entidad
        const fileName = `${formatearNombre(eliminarSufijo(entityName, 'Entity'), '-')}.entity.ts`;
        const filePath = path.join(entityDir, fileName);
        writeFileSync(filePath, template);

        // Actualizar index.ts si existe
        const indexPath = path.join(entityDir, 'index.ts');
        const exportStatement = `export {${className}} from './${formatearNombre(eliminarSufijo(entityName, 'Entity'), '-')}.entity';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            // Verificar si la entidad ya está exportada
            if (!indexContent.includes(`export {${className}}`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // --- ACTUALIZAR persistence.service.ts ---
        const servicePath = path.join(basePath, 'src/persistence/persistence.service.ts');
        if (existsSync(servicePath)) {
            let serviceContent = readFileSync(servicePath, 'utf-8');
            // 1. Agregar importación si no existe
            const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/entity['"];?/;
            if (importRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(importRegex, (match, imports) => {
                    // Limpiar comas y espacios duplicados
                    let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(className)) importList.push(className);
                    importList = Array.from(new Set(importList));
                    return `import { ${importList.join(', ')} } from "./entity";`;
                });
            } else {
                // Si no existe el import, agrégalo al principio
                serviceContent = `import { ${className} } from "./entity";\n` + serviceContent;
            }
            // 2. Agregar al array 'entity' si no está
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

        return NextResponse.json({ 
            success: true, 
            message: `Entidad ${entityName} creada exitosamente`,
            filePath: filePath
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear la entidad: ${message}` 
        }, { status: 500 });
    }
} 