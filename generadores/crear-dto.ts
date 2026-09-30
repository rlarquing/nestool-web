import { NextResponse } from 'next/server';
import { CrearDtoParams } from '@/generadores/tipos';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo } from '@/utilities/entity-utils';
import { parseEntityContent } from '@/utilities/entity-parser';
import { formatearCodigo } from '@/utilities/formatear-codigo';

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
const dtoTemplate = `$validadoresImport
import { i18nValidationMessage } from 'nestjs-i18n';
import {$swagger} from "@nestjs/swagger";
$import
export class $nameDto {
$atributos
}
`;

const createDtoTemplate = `$validadoresImport
import { i18nValidationMessage } from 'nestjs-i18n';
import {$swagger} from "@nestjs/swagger";
$import
export class Create$nameDto $padre{
$atributos
}`;

const updateDtoTemplate = `$validadoresImport
import { i18nValidationMessage } from 'nestjs-i18n';
import {$swagger} from "@nestjs/swagger";
$import
export class Update$nameDto $padre{
$atributos
}`;

const updateMultipleDtoTemplate = `$validadoresImport
import { i18nValidationMessage } from 'nestjs-i18n';
import {$swagger} from "@nestjs/swagger";
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

// L10 (F4-m1/F5-m1): example coherente por tipo — espejo de la api-base
// (create-idioma.dto.ts: 'es'/'Espanol' para strings y false para boolean;
// create-menu-traduccion.dto.ts: example: 1 para los ids de relación).
function ejemploPorTipo(tipoDato: string): string {
    if (tipoDato.endsWith('[]')) {
        switch (tipoDato.slice(0, -2)) {
            case 'number': return '[1, 2]';
            case 'boolean': return '[true]';
            case 'Date':
            case 'date': return "['2026-01-01']";
            default: return "['texto']";
        }
    }
    switch (tipoDato) {
        case 'number': return '1';
        case 'boolean': return 'false';
        case 'Date':
        case 'date': return "'2026-01-01'";
        default: return "'texto'";
    }
}

// El ejemplo provisto por la UI solo se usa si parsea para el tipo declarado;
// si no, se cae al default por tipo (evita emitir example: abc para un number).
function ejemploSwagger(tipoDato: string, ejemplo: string | undefined): string {
    const v = (ejemplo ?? '').trim().replace(/^['"]|["']$/g, '');
    if (!v) return ejemploPorTipo(tipoDato);
    if (tipoDato === 'number') return Number.isFinite(Number(v)) ? v : ejemploPorTipo(tipoDato);
    if (tipoDato === 'boolean') return v === 'true' || v === 'false' ? v : ejemploPorTipo(tipoDato);
    if (tipoDato === 'date' || tipoDato === 'Date') {
        return !Number.isNaN(Date.parse(v)) ? `'${v}'` : ejemploPorTipo(tipoDato);
    }
    if (tipoDato === 'number[]') {
        const partes = v.replace(/[\[\]\s]/g, '').split(',').filter(Boolean);
        return partes.length > 0 && partes.every((x) => Number.isFinite(Number(x)))
            ? `[${partes.join(', ')}]`
            : ejemploPorTipo(tipoDato);
    }
    return `'${v}'`;
}

// L10 F5-m1: import de class-validator solo con los validadores USADOS en el
// fichero (los DTOs de la api no arrastran imports sin usar) — vacío ⇒ sin línea.
function importClassValidator(validadores: Set<string>): string {
    return validadores.size > 0 ? `import { ${Array.from(validadores).join(', ')} } from 'class-validator';` : '';
}

// F7-C2: unificar la opcionalidad entre los DOS formatos de payload. El formulario
// "nuevo DTO" manda nuloOpcional ('noNulo'|'esOpcional'|'esNulo') y el flujo de
// edición de entity manda nulo (boolean). Antes, un payload con nulo:true caía en
// el default del switch (atributo opcional) pero NO activaba el import de
// ApiPropertyOptional → fichero con TS2304.
function opcionalidadDe(a: any): 'noNulo' | 'esOpcional' | 'esNulo' {
    if (a?.nuloOpcional) return a.nuloOpcional;
    return a?.nulo === true ? 'esNulo' : 'noNulo';
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

    // L10 F4-m1: la UI ofrece 'date'/'date[]' pero no son tipos TS — se emite Date/Date[]
    // (el switch de validadores sigue claveando sobre atributo.tipoDato original).
    if (tipo === 'date') tipo = 'Date';
    else if (tipo === 'date[]') tipo = 'Date[]';
    
    // Generar declaración del atributo según opcionalidad (F7-C2: opcionalidadDe
    // acepta nuloOpcional del formulario Y nulo:boolean del flujo de entity)
    let atributoStr = '';
    switch (opcionalidadDe(atributo)) {
        case 'noNulo':
            validadores.push('IsNotEmpty');
            codigoValidadores += '@IsNotEmpty()\n';
            atributoStr = `${atributo.nombreAtributo}!: ${tipo};`;
            break;
        case 'esOpcional':
            validadores.push('IsOptional');
            codigoValidadores += '@IsOptional()\n';
            atributoStr = `${atributo.nombreAtributo}?: ${tipo};`;
            break;
        case 'esNulo':
        default:
            validadores.push('IsOptional');
            codigoValidadores += '@IsOptional()\n';
            atributoStr = `${atributo.nombreAtributo}?: ${tipo} | null;`;
            break;
    }
    
    // Validadores según tipo de dato (mensajes traducidos vía i18n, igual que la api-base)
    switch (atributo.tipoDato) {
        case 'string':
            validadores.push('IsString');
            codigoValidadores += `@IsString({ message: i18nValidationMessage('validation.IS_STRING') })\n`;
            break;
        case 'number':
            validadores.push('IsNumber');
            codigoValidadores += `@IsNumber({}, { message: i18nValidationMessage('validation.IS_NUMBER') })\n`;
            break;
        case 'date':
            validadores.push('IsDate');
            codigoValidadores += `@IsDate({ message: i18nValidationMessage('validation.IS_DATE') })\n`;
            break;
        case 'boolean':
            validadores.push('IsBoolean');
            codigoValidadores += `@IsBoolean({ message: i18nValidationMessage('validation.IS_BOOLEAN') })\n`;
            break;
        case 'string[]':
        case 'number[]':
        case 'date[]':
        case 'boolean[]':
        case 'any[]':
        case 'dto[]':
            validadores.push('IsArray');
            codigoValidadores += `@IsArray({ message: i18nValidationMessage('validation.IS_ARRAY') })\n`;
            break;
    }

    // L10 F4-m1: opcionales con @ApiPropertyOptional (convención de la api-base,
    // update-idioma.dto.ts) y example coherente por tipo (ya no string literal).
    // F7-C2: opcionalidad vía opcionalidadDe (nuloOpcional o nulo:boolean) y
    // description por defecto = nombre del atributo (antes salía literal 'undefined').
    const esOpcionalSwagger = opcionalidadDe(atributo) !== 'noNulo';
    const descripcionSwagger = atributo.descripcion?.trim() ? atributo.descripcion : atributo.nombreAtributo;
    const apiProperty = `@${esOpcionalSwagger ? 'ApiPropertyOptional' : 'ApiProperty'}({ description: '${descripcionSwagger}', example: ${ejemploSwagger(atributo.tipoDato, atributo.ejemplo)} })\n`;
    
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
// L10 (F5-m1): validadores POR FICHERO (create y update comparten opcionalidad —
// F5-M1 — pero cada fichero importa solo lo suyo; updateMultiple añade el id en
// la ruta) + @ApiPropertyOptional para opcionales + example por tipo.
function generateCrudAttributes(atributos: any[], basePath: string): {
    create: string;
    update: string;
    read: string;
    validadoresCreate: string[];
    validadoresUpdate: string[];
    tieneOpcionales: boolean;
    parametros: string;
    thisAtributos: string;
    relacionesNomenclador: string[];
} {
    const createAttrs: string[] = [];
    const updateAttrs: string[] = [];
    const readAttrs: string[] = [];
    const validadoresCreate = new Set<string>();
    const validadoresUpdate = new Set<string>();
    let tieneOpcionales = false;
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

        // F5-M2: convención de la api-base — los ids de relación unitaria (ManyToOne/
        // OneToOne) llevan sufijo Id en los DTOs (create-menu-traduccion.dto.ts:
        // menuId!: number con description 'ID del menu'); las colecciones (OneToMany/
        // ManyToMany) conservan el nombre de la propiedad (create-user.dto.ts: roles!: number[]).
        const esRelacionUnitaria = tipo === 'relation'
            && attr.tipoRelacion !== 'OneToMany' && attr.tipoRelacion !== 'ManyToMany';
        const nombreDto = esRelacionUnitaria ? `${attr.nombreAtributo}Id` : attr.nombreAtributo;
        const descripcionDto = esRelacionUnitaria ? `ID del ${attr.nombreAtributo}` : attr.nombreAtributo;

        // L10 F5-m1: import por fichero — IsOptional solo si el campo es opcional;
        // IsNotEmpty solo en los requeridos (create y update comparten opcionalidad,
        // F5-M1; updateMultiple añade el id y se calcula en la ruta).
        if (attr.nulo === false) {
            validadoresCreate.add('IsNotEmpty');
            validadoresUpdate.add('IsNotEmpty');
        } else {
            validadoresCreate.add('IsOptional');
            validadoresUpdate.add('IsOptional');
            tieneOpcionales = true;
        }
        
        switch (tipo) {
            case 'string':
                validadoresCreate.add('IsString');
                validadoresUpdate.add('IsString');
                break;
            case 'number':
            case 'relation':
                validadoresCreate.add('IsNumber');
                validadoresUpdate.add('IsNumber');
                break;
            case 'boolean':
                validadoresCreate.add('IsBoolean');
                validadoresUpdate.add('IsBoolean');
                break;
            case 'Date':
            case 'Timestamp':
                validadoresCreate.add('IsDate');
                validadoresUpdate.add('IsDate');
                break;
        }
        if (dtoType === 'number[]') {
            validadoresCreate.add('IsArray');
            validadoresUpdate.add('IsArray');
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

        // L10 F5-m1: @ApiProperty para requeridos y @ApiPropertyOptional para
        // opcionales, con example por tipo (paridad con create-idioma.dto.ts y
        // create-menu-traduccion.dto.ts de la api-base).
        const ejemplo = ejemploPorTipo(dtoType);

        if (attr.nulo === false) {
            createAttrs.push(`    @IsNotEmpty()\n${bloqueTipo}    @ApiProperty({ description: '${descripcionDto}', example: ${ejemplo} })\n    ${nombreDto}!: ${dtoType};`);
        } else {
            createAttrs.push(`    @IsOptional()\n${bloqueTipo}    @ApiPropertyOptional({ description: '${descripcionDto}', example: ${ejemplo} })\n    ${nombreDto}?: ${dtoType};`);
        }

        // UPDATE DTO - misma opcionalidad que el create (modelo api-base:
        // update-idioma.dto.ts mantiene @IsNotEmpty en los campos requeridos)
        if (attr.nulo === false) {
            updateAttrs.push(`    @IsNotEmpty()\n${bloqueTipo}    @ApiProperty({ description: '${descripcionDto}', example: ${ejemplo} })\n    ${nombreDto}!: ${dtoType};`);
        } else {
            updateAttrs.push(`    @IsOptional()\n${bloqueTipo}    @ApiPropertyOptional({ description: '${descripcionDto}', example: ${ejemplo} })\n    ${nombreDto}?: ${dtoType};`);
        }

        // READ DTO - incluir todos (declaraciones y parámetros opcionales para que
        // el constructor positional del mapper siempre compile). Sin validadores:
        // los Read*Dto de la api-base solo llevan @ApiProperty.
        readAttrs.push(`    @ApiProperty({ description: '${descripcionDto}', example: ${ejemplo} })\n    ${nombreDto}?: ${dtoType};`);

        // Parámetros para el constructor del Read DTO (mismo nombre que la declaración)
        parametrosList.push(`${nombreDto}?: ${dtoType}`);
        thisAttrsList.push(`this.${nombreDto} = ${nombreDto};`);
    }

    return {
        create: createAttrs.join('\n\n'),
        update: updateAttrs.join('\n\n'),
        read: readAttrs.join('\n\n'),
        validadoresCreate: Array.from(validadoresCreate),
        validadoresUpdate: Array.from(validadoresUpdate),
        tieneOpcionales,
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
// Fase 5: detección estructural real del modelo api-base — el marcador fiable es
// `extends GenericNomencladorEntity` (independiente del schema; el grep del literal
// MOD_NOMENCLATOR fallaba si la entity estaba en otro schema).
function esNomenclador(basePath: string, entityName: string): boolean {
    try {
        const nameSinEntity = entityName.endsWith("Entity") ? entityName.replace("Entity", "") : entityName;
        const fileName = formatearNombre(nameSinEntity, '-') + '.entity.ts';
        const entityPath = path.join(basePath, 'src/persistence/entity', fileName);
        
        if (!existsSync(entityPath)) {
            return false;
        }
        
        const content = readFileSync(entityPath, 'utf-8');
        return content.includes('extends GenericNomencladorEntity') || content.includes('SchemaEnum.MOD_NOMENCLATOR');
    } catch {
        return false;
    }
}

export async function crearDto(params: CrearDtoParams): Promise<NextResponse> {
    try {
        const { dtoName, atributos, basePath, modo, esNomenclador = false } = params;


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
            // L10 F4-m1: $validadoresImport (import solo con validadores usados, sin
            // línea si no hay ninguno) y $swagger con ApiPropertyOptional si hay opcionales.
            const tieneOpcionalNuevo = atributos.some((a: any) => opcionalidadDe(a) !== 'noNulo');
            let template = dtoTemplate;
            template = template.replace('$validadoresImport', importClassValidator(new Set(validadores)));
            template = template.replace('$swagger', tieneOpcionalNuevo ? 'ApiProperty, ApiPropertyOptional' : 'ApiProperty');
            template = template.replace(/\$name/g, nombreSinSufijo);
            template = template.replace('$atributos', codigoAtributos);
            template = template.replace('$import', importaciones.join(''));

            // Escribir archivo (F9-m1: los artefactos pasan prettier, igual que el modelo)
            writeFileSync(filePath, await formatearCodigo(template, fileName));

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
            
            // F5-C5: los llamadores reales pasan 'MarcaEntity' → doble eliminarSufijo.
            // Sin el segundo, se generaba CreateMarcaEntityDto contra la convención de
            // la api y DESALINEADO con controller/service (que derivan CreateMarcaDto).
            const nombre = eliminarSufijo(eliminarSufijo(dtoName, 'Dto'), 'Entity');

            // L10 F5-m1: imports por fichero — solo validadores usados y ApiPropertyOptional
            // solo si hay opcionales (importClassValidator: sin set ⇒ sin línea).
            const swaggerCrud = codigoAtributos.tieneOpcionales ? 'ApiProperty, ApiPropertyOptional' : 'ApiProperty';

            // 1. CREATE DTO
            let createDtoCode = createDtoTemplate
                .replace('$validadoresImport', importClassValidator(new Set(codigoAtributos.validadoresCreate)))
                .replace('$swagger', swaggerCrud)
                .replace(/\$name/g, nombre)
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
            writeFileSync(createFilePath, await formatearCodigo(createDtoCode, 'create-x.dto.ts'));

            // 2. UPDATE DTO
            let updateDtoCode = updateDtoTemplate
                .replace('$validadoresImport', importClassValidator(new Set(codigoAtributos.validadoresUpdate)))
                .replace('$swagger', swaggerCrud)
                .replace(/\$name/g, nombre)
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
            writeFileSync(updateFilePath, await formatearCodigo(updateDtoCode, 'update-x.dto.ts'));

            // 3. UPDATE MULTIPLE DTO (el id siempre es requerido y numérico)
            const umValidadores = new Set<string>([...codigoAtributos.validadoresUpdate, 'IsNotEmpty', 'IsNumber']);
            let updateMultipleDtoCode = updateMultipleDtoTemplate
                .replace('$validadoresImport', importClassValidator(umValidadores))
                .replace('$swagger', swaggerCrud)
                .replace(/\$name/g, nombre)
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
            writeFileSync(updateMultipleFilePath, await formatearCodigo(updateMultipleDtoCode, 'update-multiple-x.dto.ts'));

            // 4. READ DTO
            const readAttributes = codigoAtributos.read;
            
            if (esNomenclador) {
                // F5-C6: el read del nomenclador es SOLO HERENCIA. El template canónico
                // re-declaraba dtoToString/id sin inicializador (TS2564) e inyectaba
                // super(id, nombre, descripcion, dtoToString) con variables inexistentes
                // (TS2304). ReadNomencladorDto ya aporta id/nombre/descripcion/dtoToString
                // y su constructor: solo se hereda, con los atributos EXTRA (si los
                // hubiera) como declaraciones opcionales — import ApiProperty solo si
                // queda algo que decorar.
                const atributosExtra = readAttributes.trim();
                const apiPropertyImport = atributosExtra ? 'import {ApiProperty} from "@nestjs/swagger";\n' : '';
                const cuerpo = atributosExtra ? `\n    ${atributosExtra}\n` : '';
                const readFinalNomenclador = `${apiPropertyImport}import { ReadNomencladorDto } from './read-nomenclador.dto';\n\nexport class Read${nombre}Dto extends ReadNomencladorDto {${cuerpo}}\n`;
                const readFilePathNom = path.join(dtoDir, `read-${formatearNombre(nombre, '-')}.dto.ts`);
                writeFileSync(readFilePathNom, await formatearCodigo(readFinalNomenclador, 'read-x.dto.ts'));
            } else {
                const readDtoCode = readDtoTemplate
                    .replace('$swagger', 'ApiProperty')
                    .replace(/\$name/g, nombre)
                    .replace('$atributos', readAttributes)
                    .replace('$parametros', codigoAtributos.parametros)
                    .replace('$thisAtributos', codigoAtributos.thisAtributos);
                
                const readFinalCode = readDtoCode
                    .replace('$padre', '')
                    .replace('$import', '')
                    .replace('$super', 'this.dtoToString = dtoToString; this.id = id;');
                
                const readFilePath = path.join(dtoDir, `read-${formatearNombre(nombre, '-')}.dto.ts`);
                writeFileSync(readFilePath, await formatearCodigo(readFinalCode, 'read-x.dto.ts'));
            }

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
