import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';
import { registrarEntidadEnIndex, registrarEntidadEnPersistence } from '@/utilities/relacion-inversa';
import { genericNomencladorEntity } from '@/template/entity.template';
import { repositoryNomencladorTemplate } from '@/template/repository.template';

// Fase 5 (F3-C1/C2/C3): el nomenclador pasa de INERTE a VIVO.
//  - F3-C1: ya no se parchea el repository GENÉRICO (clase plana con mapa por
//    instancia; inyectarle @InjectRepository no compila y rompería los super()).
//  - F3-C2: se genera un repository CONCRETO (repositoryNomencladorTemplate) que
//    implementa OnModuleInit y registra su Repository<X> en la instancia
//    COMPARTIDA del genérico (la única consultada por GenericNomencladorService).
//    Se da de alta en repository/index.ts y en el array `export const repository`
//    de persistence.service.ts (patrón F7), y la entity en `export const entity`.
//  - F3-C3: schema por defecto MOD_NOMENCLATOR (uppercase, patrón F1-C6); con el
//    fallback 'public' el generador de DTOs dejaba de detectarla como nomencladora.
//  - CONTRATO verificado contra main.ts/controller: valor del NomencladorTypeEnum
//    == nombre de registro del repo == :name del controller (main.ts itera el enum
//    para crear el menú del nomenclador).
//  - Atomicidad: pre-check 409 de entity Y repository ANTES de escribir nada.

/** Añade un export a un barrel index.ts garantizando newline final (evita
 *  concatenar sobre la última línea si el fichero no terminaba en \n). */
function altaEnIndex(indexPath: string, className: string, exportStatement: string): boolean {
    if (existsSync(indexPath)) {
        let indexContent = readFileSync(indexPath, 'utf-8');
        if (indexContent.includes(className)) return false; // ya registrado: idempotente
        if (indexContent.length > 0 && !indexContent.endsWith('\n')) indexContent += '\n';
        writeFileSync(indexPath, indexContent + exportStatement);
        return true;
    }
    writeFileSync(indexPath, exportStatement);
    return true;
}

export async function POST(req: NextRequest) {
    const avisos: string[] = [];
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

        const repositoryClassName = nombreSinSufijo + 'Repository';
        const entityDir = path.join(basePath, 'src/persistence/entity');
        const repositoryDir = path.join(basePath, 'src/persistence/repository');
        const filePath = path.join(entityDir, `${nombreKebab}.entity.ts`);
        const repoFilePath = path.join(repositoryDir, `${nombreKebab}.repository.ts`);

        // F3-C3: el default del dominio nomenclador es MOD_NOMENCLATOR (uppercase,
        // patrón F1-C6: la entity referencía la CLAVE del SchemaEnum, no el literal).
        const esquemaEnum = (esquema || 'MOD_NOMENCLATOR').toString().toUpperCase();

        // --- PRE-CHECK de atomicidad: nada se escribe si algo ya existe ---
        if (existsSync(filePath)) {
            return NextResponse.json({
                error: `La entidad ${className} ya existe en este proyecto`
            }, { status: 409 });
        }
        if (existsSync(repoFilePath)) {
            return NextResponse.json({
                error: `El repository ${repositoryClassName} ya existe en este proyecto`
            }, { status: 409 });
        }

        // --- 1. Entity del nomenclador ---
        if (!existsSync(entityDir)) {
            mkdirSync(entityDir, { recursive: true });
        }
        let template = genericNomencladorEntity;
        template = template.replace('$nameEntity', className);
        template = template.replace('$entidad', nombreFormateado);
        template = template.replace('$schema', esquemaEnum);
        writeFileSync(filePath, template);

        // Alta en entity/index.ts (helper compartido: formato con espacios como la api)
        registrarEntidadEnIndex(entityDir, className, nombreKebab);

        // --- 2. Repository concreto + registro en la instancia compartida (F3-C1/C2) ---
        if (!existsSync(repositoryDir)) {
            mkdirSync(repositoryDir, { recursive: true });
        }
        const repoTemplate = repositoryNomencladorTemplate
            .replace(/\$nameEntity/g, className)
            .replace(/\$name/g, nombreSinSufijo)
            .replace(/\$param/g, nombreLower)
            .replace(/\$registro/g, nombreLower);
        writeFileSync(repoFilePath, repoTemplate);

        // Alta en repository/index.ts (formato con espacios, igual al de la api)
        altaEnIndex(
            path.join(repositoryDir, 'index.ts'),
            repositoryClassName,
            `export { ${repositoryClassName} } from './${nombreKebab}.repository';\n`,
        );

        // --- 3. persistence.service.ts: registro dinámico dual (patrón F7) ---
        const servicePath = path.join(basePath, 'src/persistence/persistence.service.ts');
        let entityEnPersistence = false;
        let repoEnPersistence = false;
        if (existsSync(servicePath)) {
            // 3a. Entity → import './entity' + array `export const entity`
            registrarEntidadEnPersistence(servicePath, className);

            // 3b. Repository concreto → import './repository' + array `export const repository`
            let serviceContent = readFileSync(servicePath, 'utf-8');
            const repoImportRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/repository['"];?/;
            if (repoImportRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(repoImportRegex, (match, imports) => {
                    const importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(repositoryClassName)) importList.push(repositoryClassName);
                    return `import { ${Array.from(new Set(importList)).join(', ')} } from './repository';`;
                });
            } else {
                serviceContent = `import { ${repositoryClassName} } from './repository';\n` + serviceContent;
            }
            const repoArrayRegex = /export\s+const\s+repository\s*=\s*\[([^\]]*)\]/;
            if (repoArrayRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(repoArrayRegex, (match, items) => {
                    const itemList = items.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!itemList.includes(repositoryClassName)) itemList.push(repositoryClassName);
                    return `export const repository = [${Array.from(new Set(itemList)).join(', ')}]`;
                });
                repoEnPersistence = true;
            } else {
                avisos.push('persistence.service.ts no tiene array `export const repository`: el repository concreto NO quedó registrado en providers.');
            }
            writeFileSync(servicePath, serviceContent);

            // Verificación honesta del alta de la entity (el helper no reporta)
            entityEnPersistence = readFileSync(servicePath, 'utf-8').includes(className);
        } else {
            avisos.push('No existe src/persistence/persistence.service.ts: entity y repository NO quedaron registrados.');
        }

        // --- 4. nomenclador-type.enum.ts: valor == nombre de registro == :name ---
        const enumPath = path.join(basePath, 'src/shared/enum/nomenclador-type.enum.ts');
        let enumAgregado = false;
        const claveEnum = nombreSinSufijo.toUpperCase();
        if (existsSync(enumPath)) {
            let enumContent = readFileSync(enumPath, 'utf-8');
            // Idempotente por valor Y por clave
            if (!enumContent.includes(`= '${nombreLower}'`) && !enumContent.includes(`${claveEnum} =`)) {
                const enumRegex = /export\s+enum\s+\w+\s*\{([\s\S]*?)\}/;
                const enumMatch = enumRegex.exec(enumContent);
                if (enumMatch) {
                    const body = enumMatch[1].trimEnd();
                    const nuevaLinea = `  ${claveEnum} = '${nombreLower}',`;
                    const nuevoBody = body ? `${body}\n${nuevaLinea}\n` : `\n${nuevaLinea}\n`;
                    enumContent = enumContent.replace(enumMatch[0], `export enum ${enumMatch[0].match(/export\s+enum\s+(\w+)/)![1]} {${nuevoBody}}`);
                    if (!enumContent.endsWith('\n')) enumContent += '\n';
                    writeFileSync(enumPath, enumContent);
                    enumAgregado = true;
                } else {
                    avisos.push('nomenclador-type.enum.ts no contiene un enum exportable: el menú del nomenclador no se creará (alta manual requerida).');
                }
            } else {
                enumAgregado = true; // ya estaba
            }
        } else {
            avisos.push('No existe src/shared/enum/nomenclador-type.enum.ts: main.ts no creará el menú del nomenclador (alta manual requerida).');
        }

        return NextResponse.json({
            success: true,
            message: `Nomenclador ${className} creado y registrado exitosamente`,
            filePath: filePath,
            registro: {
                entity: className,
                entityRegistrada: entityEnPersistence,
                repository: repositoryClassName,
                repositoryRegistrado: repoEnPersistence,
                registroEnGenerico: `${repositoryClassName}.onModuleInit() → registerRepository('${nombreLower}', ...)`,
                enum: enumAgregado ? `${claveEnum} = '${nombreLower}'` : null,
                esquema: esquemaEnum,
            },
            avisos,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: `Error al crear el nomenclador: ${message}`
        }, { status: 500 });
    }
}
