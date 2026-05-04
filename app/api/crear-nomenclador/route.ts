import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';
import { genericNomencladorEntity } from '@/template/entity.template';

export async function POST(req: NextRequest) {
    try {
        const { entityName, esquema, basePath } = await req.json();

        // Validaciones básicas
        if (!entityName || !basePath) {
            return NextResponse.json({ 
                error: 'entityName y basePath son requeridos' 
            }, { status: 400 });
        }

        // Validar que el nombre de la entidad sea válido
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
            return NextResponse.json({ 
                error: 'El nombre de la entidad debe empezar con mayúscula y contener solo letras y números' 
            }, { status: 400 });
        }

        // El nombre de la clase SIEMPRE termina en Entity
        const className = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const nombreSinSufijo = eliminarSufijo(entityName, 'Entity');
        const nombreFormateado = formatearNombre(nombreSinSufijo, '_');
        const nombreKebab = formatearNombre(nombreSinSufijo, '-');
        const nombreLower = aInicialMinuscula(nombreSinSufijo);

        // Crear directorio si no existe
        const entityDir = path.join(basePath, 'src/persistence/entity');
        if (!existsSync(entityDir)) {
            mkdirSync(entityDir, { recursive: true });
        }

        // Preparar el template del nomenclador
        let template = genericNomencladorEntity;
        template = template.replace('$nameEntity', className);
        template = template.replace('$entidad', nombreFormateado);
        template = template.replace('$schema', esquema || 'public');

        // Escribir archivo de entidad
        const fileName = `${nombreKebab}.entity.ts`;
        const filePath = path.join(entityDir, fileName);

        // Verificar si ya existe
        if (existsSync(filePath)) {
            return NextResponse.json({ 
                error: `La entidad ${className} ya existe en este proyecto` 
            }, { status: 409 });
        }

        writeFileSync(filePath, template);

        // Actualizar index.ts
        const indexPath = path.join(entityDir, 'index.ts');
        const exportStatement = `export {${className}} from './${nombreKebab}.entity';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
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
                    let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(className)) importList.push(className);
                    importList = Array.from(new Set(importList));
                    return `import { ${importList.join(', ')} } from "./entity";`;
                });
            } else {
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

        // --- ACTUALIZAR generic-nomenclador.repository.ts ---
        const repoPath = path.join(basePath, 'src/persistence/repository/generic-nomenclador.repository.ts');
        if (existsSync(repoPath)) {
            let repoContent = readFileSync(repoPath, 'utf-8');
            
            // Agregar import de la entidad si no existe
            const importLine = `import { ${className} } from '../entity/${nombreKebab}.entity';`;
            if (!repoContent.includes(importLine)) {
                // Insertar después del último import
                const lastImportIndex = repoContent.lastIndexOf('import ');
                const lastImportEnd = repoContent.indexOf('\n', lastImportIndex) + 1;
                repoContent = repoContent.slice(0, lastImportEnd) + importLine + '\n' + repoContent.slice(lastImportEnd);
            }

            // Agregar parámetro al constructor
            const paramLine = `@InjectRepository(${className}) protected ${nombreLower}Repository: Repository<${className}>,`;
            if (!repoContent.includes(paramLine)) {
                // Buscar el constructor y agregar el parámetro
                const constructorMatch = repoContent.match(/constructor\s*\(/);
                if (constructorMatch) {
                    const insertIndex = repoContent.indexOf('(', constructorMatch.index) + 1;
                    repoContent = repoContent.slice(0, insertIndex) + '\n        ' + paramLine + repoContent.slice(insertIndex);
                }
            }
            
            writeFileSync(repoPath, repoContent);
        }

        // --- ACTUALIZAR nomenclador-type.enum.ts ---
        const enumPath = path.join(basePath, 'src/shared/enum/nomenclador-type.enum.ts');
        if (existsSync(enumPath)) {
            let enumContent = readFileSync(enumPath, 'utf-8');
            const enumEntry = `${nombreSinSufijo.toUpperCase()} = '${nombreLower}'`;
            
            // Buscar si ya existe el enum
            if (!enumContent.includes(`${nombreSinSufijo.toUpperCase()} =`)) {
                // Buscar el cuerpo del enum y agregar el nuevo valor
                const enumMatch = enumContent.match(/export\s+enum\s+\w+\s*{([^}]*)}/);
                if (enumMatch) {
                    const enumBody = enumMatch[1];
                    if (enumBody.trim() === '') {
                        // Enum vacío
                        enumContent = enumContent.replace(/{\s*}/, `{\n  ${enumEntry},\n}`);
                    } else {
                        // Agregar al final del enum
                        enumContent = enumContent.replace(/}([^}]*)$/, `  ${enumEntry},\n}${enumMatch[0].slice(enumMatch[0].lastIndexOf('}') + 1)}`);
                    }
                }
                writeFileSync(enumPath, enumContent);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Nomenclador ${className} creado exitosamente`,
            filePath: filePath
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el nomenclador: ${message}` 
        }, { status: 500 });
    }
}
