import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo } from '@/utilities/entity-utils';
import { parseEntityContent } from '@/utilities/entity-parser';

// Parser de atributos de una entidad — delega en el parser robusto compartido
// (utilities/entity-parser, fuente única con crear-mapper/crear-repository).
// El antiguo parser de regex por línea perdía los decoradores multi-línea
// (el walk-up se cortaba en líneas como "nullable: false,") y con ellos las
// RELACIONES, que quedaban tipadas como string en los DTOs.
function parseEntityAttributes(content: string): any[] {
    const info = parseEntityContent(content);
    if (!info) return [];
    // OneToMany se excluye (colección sin FK propia, no entra en los DTOs CRUD),
    // misma convención que el parser anterior.
    return info.atributos
        .filter((a) => !(a.tipo === 'relacion' && a.tipoRelacion === 'OneToMany'))
        .map((a) => {
            if (a.tipo === 'columna') {
                const atributo: any = {
                    nombreAtributo: a.nombre,
                    tipoDato: normalizarTipoTs(a.tipoTs),
                    nulo: a.opcional,
                    unico: a.esUnica,
                };
                if (a.length) atributo.length = a.length;
                if (a.esInteger) atributo.integer = true;
                return atributo;
            }
            return {
                nombreAtributo: a.nombre,
                tipoDato: 'relation',
                nulo: a.opcional,
                rEntity: a.destino,
                tipoRelacion: a.tipoRelacion,
            };
        });
}

// Normaliza el tipo TS capturado por el parser a los tokens que espera la
// generación de DTOs (misma tabla que mapTypeScriptType).
function normalizarTipoTs(tipoTs: string): string {
    const base = tipoTs.split('|')[0].trim();
    const typeMap: { [key: string]: string } = {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
        'Date': 'Date',
        'Timestamp': 'Timestamp',
        'Geometry': 'Geometry',
    };
    return typeMap[base] || 'string';
}

// Templates para DTOs
const dtoTemplate = `import {$validadores} from "class-validator";
import { i18nValidationMessage } from 'nestjs-i18n';
import {ApiProperty} from "@nestjs/swagger";
$import
export class $nameDto {
$atributos
}
`;

const createDtoTemplate = `import {$validadores} from "class-validator";
import { i18nValidationMessage } from 'nestjs-i18n';
import {ApiProperty} from "@nestjs/swagger";
$import
export class Create$nameDto $padre{
$atributos
}`;

const updateDtoTemplate = `import {$validadores} from "class-validator"
import { i18nValidationMessage } from 'nestjs-i18n';
import {ApiProperty} from "@nestjs/swagger";
$import
export class Update$nameDto $padre{
$atributos
}`;

const updateMultipleDtoTemplate = `import {$validadores} from "class-validator";
import { i18nValidationMessage } from 'nestjs-i18n';
import {ApiProperty} from "@nestjs/swagger";
$import
export class UpdateMultiple$nameDto $padre {

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({ description: 'id de la $name', example: 1 })
    id!: number

    $atributos
}`;

const readDtoTemplate = `import {ApiProperty} from "@nestjs/swagger";
$import
export class Read$nameDto $padre {
    @ApiProperty({ description: 'Nombre del objeto', example: 'Objeto 1' })
    dtoToString: string;
    @ApiProperty({description: 'id de la entidad.', example: 1})
    id: number;
    $atributos
    constructor(dtoToString: string, id: number, $parametros) {
    $super      
        $thisAtributos
    }
}`;

interface AtributoDto {
    nombreAtributo: string;
    tipoDato: string;
    dtoReferencia?: string;
    nuloOpcional: 'esNulo' | 'noNulo' | 'esOpcional';
    descripcion: string;
    ejemplo: string;
}

function generarAtributoDto(atributo: AtributoDto): { 
    atributo: string; 
    validadores: string[]; 
    codigo: string;
    importacion?: string;
} {
    const validadores: string[] = [];
    let codigoValidadores = '';
    let tipo = atributo.tipoDato;
    
    // Si es un DTO referenciado
    if (atributo.tipoDato === 'dto' || atributo.tipoDato === 'dto[]') {
        if (atributo.dtoReferencia) {
            tipo = atributo.tipoDato === 'dto[]' ? atributo.dtoReferencia + '[]' : atributo.dtoReferencia;
        }
    }
    
    // Generar declaración del atributo según opcionalidad
    let atributoStr = '';
    switch (atributo.nuloOpcional) {
        case 'noNulo':
            validadores.push('IsNotEmpty');
            codigoValidadores += ' @IsNotEmpty()\n';
            atributoStr = ` ${atributo.nombreAtributo}!: ${tipo};`;
            break;
        case 'esOpcional':
            validadores.push('IsOptional');
            codigoValidadores += ' @IsOptional()\n';
            atributoStr = ` ${atributo.nombreAtributo}?: ${tipo};`;
            break;
        case 'esNulo':
        default:
            validadores.push('IsOptional');
            codigoValidadores += ' @IsOptional()\n';
            atributoStr = ` ${atributo.nombreAtributo}?: ${tipo} | null;`;
            break;
    }
    
    // Validadores según tipo de dato (mensajes traducidos vía i18n, igual que la api-base)
    switch (atributo.tipoDato) {
        case 'string':
            validadores.push('IsString');
            codigoValidadores += ` @IsString({ message: i18nValidationMessage('validation.IS_STRING') })\n`;
            break;
        case 'number':
            validadores.push('IsNumber');
            codigoValidadores += ` @IsNumber({}, { message: i18nValidationMessage('validation.IS_NUMBER') })\n`;
            break;
        case 'date':
            validadores.push('IsDate');
            codigoValidadores += ` @IsDate({ message: i18nValidationMessage('validation.IS_DATE') })\n`;
            break;
        case 'boolean':
            validadores.push('IsBoolean');
            codigoValidadores += ` @IsBoolean({ message: i18nValidationMessage('validation.IS_BOOLEAN') })\n`;
            break;
        case 'string[]':
        case 'number[]':
        case 'date[]':
        case 'boolean[]':
        case 'any[]':
        case 'dto[]':
            validadores.push('IsArray');
            codigoValidadores += ` @IsArray({ message: i18nValidationMessage('validation.IS_ARRAY') })\n`;
            break;
    }
    
    // ApiProperty
    const apiProperty = ` @ApiProperty({description: '${atributo.descripcion}', example: '${atributo.ejemplo}'})\n`;
    
    const codigoCompleto = codigoValidadores + apiProperty + atributoStr;
    
    // Generar importación si es un DTO
    let importacion = '';
    if ((atributo.tipoDato === 'dto' || atributo.tipoDato === 'dto[]') && atributo.dtoReferencia) {
        const nombreDto = eliminarSufijo(atributo.dtoReferencia, 'Dto');
        importacion = `import { ${atributo.dtoReferencia} } from './${formatearNombre(nombreDto, '-')}.dto';\n`;
    }
    
    return {
        atributo: atributoStr,
        validadores,
        codigo: codigoCompleto,
        importacion
    };
}

// Generar atributos para los DTOs CRUD basados en los atributos de la entidad
function generateCrudAttributes(atributos: any[], basePath: string): {
    create: string;
    update: string;
    read: string;
    validadores: string[];
    parametros: string;
    thisAtributos: string;
    relacionesNomenclador: string[];
} {
    const createAttrs: string[] = [];
    const updateAttrs: string[] = [];
    const readAttrs: string[] = [];
    const validadoresSet = new Set<string>();
    const parametrosList: string[] = [];
    const thisAttrsList: string[] = [];
    const relacionesNomenclador: string[] = [];

    for (const attr of atributos) {
        const tipo = attr.tipoDato;
        
        // Mapear tipos de TypeScript a tipos de DTO
        let dtoType = mapDtoType(tipo, attr.rEntity);
        
        // Detectar si es nomenclador para relaciones
        if (tipo === 'relation' && attr.rEntity) {
            const esNom = esNomenclador(basePath, attr.rEntity);
            if (esNom) {
                relacionesNomenclador.push(attr.nombreAtributo);
            }
            // Convención de la api-base: TODAS las relaciones (incluidas las que apuntan
            // a nomencladores) se expresan por id — nunca con ReadNomencladorDto
            // (ver create-user.dto.ts: roles!: number[]; create-menu-traduccion.dto.ts: menuId!: number)
            dtoType = (attr.tipoRelacion === 'OneToMany' || attr.tipoRelacion === 'ManyToMany')
                ? 'number[]'
                : 'number';
        }

        // Generar validadores según nullable (las relaciones requeridas TAMBIÉN
        // necesitan IsNotEmpty en el create, como en la api-base)
        if (attr.nulo === false) {
            validadoresSet.add('IsNotEmpty');
        }
        // Los templates siempre emiten @IsOptional(), garantizar el import
        validadoresSet.add('IsOptional');
        
        switch (tipo) {
            case 'string':
                validadoresSet.add('IsString');
                break;
            case 'number':
            case 'relation':
                validadoresSet.add('IsNumber');
                break;
            case 'boolean':
                validadoresSet.add('IsBoolean');
                break;
            case 'Date':
            case 'Timestamp':
                validadoresSet.add('IsDate');
                break;
        }
        if (dtoType === 'number[]') {
            validadoresSet.add('IsArray');
        }

        // CREATE DTO
        // Validador por tipo con mensaje i18n (mismo estilo que la api-base)
        let tipoValidador = '';
        if (dtoType === 'string') tipoValidador = `@IsString({ message: i18nValidationMessage('validation.IS_STRING') })`;
        else if (dtoType === 'number') tipoValidador = `@IsNumber({}, { message: i18nValidationMessage('validation.IS_NUMBER') })`;
        else if (dtoType === 'number[]') tipoValidador = `@IsArray({ message: i18nValidationMessage('validation.IS_ARRAY') })`;
        else if (dtoType === 'boolean') tipoValidador = `@IsBoolean({ message: i18nValidationMessage('validation.IS_BOOLEAN') })`;
        else if (dtoType === 'Date') tipoValidador = `@IsDate({ message: i18nValidationMessage('validation.IS_DATE') })`;
        const bloqueTipo = tipoValidador ? `    ${tipoValidador}\n` : '';

        if (attr.nulo === false) {
            createAttrs.push(`    @IsNotEmpty()\n${bloqueTipo}    @ApiProperty({ description: '${attr.nombreAtributo}' })\n    ${attr.nombreAtributo}!: ${dtoType};`);
        } else {
            createAttrs.push(`    @IsOptional()\n${bloqueTipo}    @ApiProperty({ description: '${attr.nombreAtributo}', required: false })\n    ${attr.nombreAtributo}?: ${dtoType};`);
        }

        // UPDATE DTO - misma opcionalidad que el create (modelo api-base:
        // update-idioma.dto.ts mantiene @IsNotEmpty en los campos requeridos)
        if (attr.nulo === false) {
            updateAttrs.push(`    @IsNotEmpty()\n${bloqueTipo}    @ApiProperty({ description: '${attr.nombreAtributo}' })\n    ${attr.nombreAtributo}!: ${dtoType};`);
        } else {
            updateAttrs.push(`    @IsOptional()\n${bloqueTipo}    @ApiProperty({ description: '${attr.nombreAtributo}', required: false })\n    ${attr.nombreAtributo}?: ${dtoType};`);
        }

        // READ DTO - incluir todos (declaraciones y parámetros opcionales para que
        // el constructor positional del mapper siempre compile). Sin validadores:
        // los Read*Dto de la api-base solo llevan @ApiProperty.
        readAttrs.push(`    @ApiProperty({ description: '${attr.nombreAtributo}', required: false })\n    ${attr.nombreAtributo}?: ${dtoType};`);

        // Parámetros para el constructor del Read DTO
        parametrosList.push(`${attr.nombreAtributo}?: ${dtoType}`);
        thisAttrsList.push(`this.${attr.nombreAtributo} = ${attr.nombreAtributo};`);
    }

    return {
        create: createAttrs.join('\n\n'),
        update: updateAttrs.join('\n\n'),
        read: readAttrs.join('\n\n'),
        validadores: Array.from(validadoresSet),
        parametros: parametrosList.join(', '),
        thisAtributos: thisAttrsList.join('\n    '),
        relacionesNomenclador: relacionesNomenclador
    };
}

function mapDtoType(tipo: string, relatedEntity?: string): string {
    if (tipo === 'relation' && relatedEntity) {
        return relatedEntity;
    }
    
    const typeMap: { [key: string]: string } = {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
        'Date': 'Date',
        'Timestamp': 'Date',
        'Geometry': 'any',
    };
    
    return typeMap[tipo] || 'string';
  }

// Función para verificar si una entidad es un nomenclador
function esNomenclador(basePath: string, entityName: string): boolean {
    try {
        const nameSinEntity = entityName.endsWith("Entity") ? entityName.replace("Entity", "") : entityName;
        const fileName = formatearNombre(nameSinEntity, '-') + '.entity.ts';
        const entityPath = path.join(basePath, 'src/persistence/entity', fileName);
        
        if (!existsSync(entityPath)) {
            return false;
        }
        
        const content = readFileSync(entityPath, 'utf-8');
        return content.includes('SchemaEnum.MOD_NOMENCLATOR');
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { dtoName, atributos, basePath, modo, esNomenclador = false } = await req.json();


        // Validaciones básicas
        if (!dtoName || !basePath) {
            return NextResponse.json({ 
                error: 'dtoName y basePath son requeridos' 
            }, { status: 400 });
        }

        if (!modo || (modo !== 'nuevo' && modo !== 'crud')) {
            return NextResponse.json({ 
                error: 'modo debe ser "nuevo" o "crud"' 
            }, { status: 400 });
        }

        // Validar nombre del DTO
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(dtoName)) {
            return NextResponse.json({ 
                error: 'El nombre del DTO debe empezar con mayúscula y contener solo letras y números' 
            }, { status: 400 });
        }

        // Crear directorio si no existe
        const dtoDir = path.join(basePath, 'src/shared/dto');
        if (!existsSync(dtoDir)) {
            mkdirSync(dtoDir, { recursive: true });
        }

        const nombreSinSufijo = eliminarSufijo(dtoName, 'Dto');
        const fileName = `${formatearNombre(nombreSinSufijo, '-')}.dto.ts`;
        const filePath = path.join(dtoDir, fileName);

        if (modo === 'nuevo') {
            // Crear DTO simple
            if (!atributos || !Array.isArray(atributos) || atributos.length === 0) {
                return NextResponse.json({ 
                    error: 'Se requiere al menos un atributo' 
                }, { status: 400 });
            }

            // Procesar atributos
            let codigoAtributos = '';
            let validadores: string[] = [];
            let importaciones: string[] = [];

            for (const attr of atributos) {
                const resultado = generarAtributoDto(attr);
                codigoAtributos += resultado.codigo + '\n\n';
                validadores = [...validadores, ...resultado.validadores];
                if (resultado.importacion) {
                    importaciones.push(resultado.importacion);
                }
            }

            // Eliminar duplicados
            validadores = [...new Set(validadores)];
            importaciones = [...new Set(importaciones)];

            // Preparar template
            let template = dtoTemplate;
            template = template.replace('$validadores', validadores.join(', '));
            template = template.replace('$swagger', 'ApiProperty');
            template = template.replace('$name', nombreSinSufijo);
            template = template.replace('$atributos', codigoAtributos);
            template = template.replace('$import', importaciones.join(''));

            // Escribir archivo
            writeFileSync(filePath, template);

            // Actualizar index.ts
            const indexPath = path.join(dtoDir, 'index.ts');
            const exportStatement = `export {${nombreSinSufijo}Dto} from './${formatearNombre(nombreSinSufijo, '-')}.dto';\n`;
            
            if (existsSync(indexPath)) {
                const indexContent = readFileSync(indexPath, 'utf-8');
                if (!indexContent.includes(`export {${nombreSinSufijo}Dto}`)) {
                    writeFileSync(indexPath, indexContent + exportStatement);
                }
            } else {
                writeFileSync(indexPath, exportStatement);
            }

            return NextResponse.json({ 
                success: true, 
                message: `DTO ${nombreSinSufijo}Dto creado exitosamente`,
                filePath: filePath
            });

        } else {
            // Modo CRUD - crear 4 DTOs (Create, Update, UpdateMultiple, Read)
            // esNomenclador ya viene del body parsing inicial
            
            
            // Leer la entidad para obtener sus atributos
            const entityNameSinEntity = dtoName.endsWith("Entity") ? dtoName.replace("Entity", "") : dtoName;
            const entityFileName = formatearNombre(entityNameSinEntity, '-'); // Convierte a kebab-case
          
            const entityPath =  path.join(basePath, "src/persistence/entity", `${entityFileName}.entity.ts`);
       
            if (!existsSync(entityPath)) {
                return NextResponse.json({ 
                    error: `No se encontró el archivo de entidad: ${entityFileName}.entity.ts en ${path.join(basePath, "src/persistence/entity")}` 
                }, { status: 404 });
            }

            const entityContent = readFileSync(entityPath, "utf-8");
            const entityAtributos = parseEntityAttributes(entityContent);
            
            // Generar código para cada tipo de atributo
            const codigoAtributos = generateCrudAttributes(entityAtributos, basePath);
            
            const nombre = eliminarSufijo(dtoName, 'Dto');

            // 1. CREATE DTO
            let createDtoCode = createDtoTemplate
                .replace('$validadores', codigoAtributos.validadores.join(', '))
                .replace('$swagger', 'ApiProperty')
                .replace('$name', nombre)
                .replace('$atributos', codigoAtributos.create);
            
            if (esNomenclador) {
                createDtoCode = createDtoCode
                    .replace('$padre', 'extends CreateNomencladorDto')
                    .replace('$import', "import { CreateNomencladorDto } from './create-nomenclador.dto';");
            } else {
                createDtoCode = createDtoCode
                    .replace('$padre', '')
                    .replace('$import', '');
            }

            const createFilePath = path.join(dtoDir, `create-${formatearNombre(nombre, '-')}.dto.ts`);
            writeFileSync(createFilePath, createDtoCode);

            // 2. UPDATE DTO
            let updateDtoCode = updateDtoTemplate
                .replace('$validadores', codigoAtributos.validadores.join(', '))
                .replace('$swagger', 'ApiProperty')
                .replace('$name', nombre)
                .replace('$atributos', codigoAtributos.update);
            
            if (esNomenclador) {
                updateDtoCode = updateDtoCode
                    .replace('$padre', 'extends UpdateNomencladorDto')
                    .replace('$import', "import { UpdateNomencladorDto } from './update-nomenclador.dto';");
            } else {
                updateDtoCode = updateDtoCode
                    .replace('$padre', '')
                    .replace('$import', '');
            }

            const updateFilePath = path.join(dtoDir, `update-${formatearNombre(nombre, '-')}.dto.ts`);
            writeFileSync(updateFilePath, updateDtoCode);

            // 3. UPDATE MULTIPLE DTO (el id siempre es requerido y numérico)
            const umValidadores = Array.from(new Set([...codigoAtributos.validadores, 'IsNotEmpty', 'IsNumber']));
            let updateMultipleDtoCode = updateMultipleDtoTemplate
                .replace('$validadores', umValidadores.join(', '))
                .replace('$swagger', 'ApiProperty')
                .replace('$name', nombre)
                .replace('$atributos', codigoAtributos.update);
            
            if (esNomenclador) {
                updateMultipleDtoCode = updateMultipleDtoCode
                    .replace('$padre', 'extends UpdateMultipleNomencladorDto')
                    .replace('$import', "import { UpdateMultipleNomencladorDto } from './update-multiple-nomenclador.dto';");
            } else {
                updateMultipleDtoCode = updateMultipleDtoCode
                    .replace('$padre', '')
                    .replace('$import', '');
            }

            const updateMultipleFilePath = path.join(dtoDir, `update-multiple-${formatearNombre(nombre, '-')}.dto.ts`);
            writeFileSync(updateMultipleFilePath, updateMultipleDtoCode);

            // 4. READ DTO
            const readAttributes = codigoAtributos.read;
            const readDtoCode = readDtoTemplate
                .replace('$swagger', 'ApiProperty')
                .replace('$name', nombre)
                .replace('$atributos', readAttributes)
                .replace('$parametros', codigoAtributos.parametros)
                .replace('$thisAtributos', codigoAtributos.thisAtributos);
            
            let readFinalCode = readDtoCode;
            if (esNomenclador) {
                readFinalCode = readDtoCode
                    .replace('$padre', 'extends ReadNomencladorDto')
                    .replace('$import', "import { ReadNomencladorDto } from './read-nomenclador.dto';")
                    .replace('$super', 'super(id, nombre, descripcion, dtoToString);');
            } else {
                readFinalCode = readDtoCode
                    .replace('$padre', '')
                    .replace('$import', '')
                    .replace('$super', 'this.dtoToString = dtoToString; this.id = id;');
            }

            const readFilePath = path.join(dtoDir, `read-${formatearNombre(nombre, '-')}.dto.ts`);
            writeFileSync(readFilePath, readFinalCode);

            // Actualizar index.ts
            const indexPath = path.join(dtoDir, 'index.ts');
            const exports = [
                `export {Create${nombre}Dto} from './create-${formatearNombre(nombre, '-')}.dto';\n`,
                `export {Update${nombre}Dto} from './update-${formatearNombre(nombre, '-')}.dto';\n`,
                `export {UpdateMultiple${nombre}Dto} from './update-multiple-${formatearNombre(nombre, '-')}.dto';\n`,
                `export {Read${nombre}Dto} from './read-${formatearNombre(nombre, '-')}.dto';\n`
            ].join('');

            if (existsSync(indexPath)) {
                const indexContent = readFileSync(indexPath, 'utf-8');
                let newExports = '';
                if (!indexContent.includes(`Create${nombre}Dto`)) newExports += exports;
                writeFileSync(indexPath, indexContent + newExports);
            } else {
                writeFileSync(indexPath, exports);
            }

            return NextResponse.json({ 
                success: true, 
                message: `DTOs CRUD creados exitosamente para ${dtoName}`,
                files: [
                    `create-${formatearNombre(nombre, '-')}.dto.ts`,
                    `update-${formatearNombre(nombre, '-')}.dto.ts`,
                    `update-multiple-${formatearNombre(nombre, '-')}.dto.ts`,
                    `read-${formatearNombre(nombre, '-')}.dto.ts`
                ]
            });
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el DTO: ${message}` 
        }, { status: 500 });
    }
}
