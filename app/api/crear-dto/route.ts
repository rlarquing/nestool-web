import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo } from '@/utilities/entity-utils';

// Templates para DTOs
const dtoTemplate = `import {$validadores} from "class-validator";
import {ApiProperty, $swagger} from "@nestjs/swagger";
$import
export class $nameDto {
$atributos
}
`;

const createDtoTemplate = `import {$validadores} from "class-validator";
import {ApiProperty, $swagger} from "@nestjs/swagger";
$import
export class Create$nameDto $padre{
$atributos
}`;

const updateDtoTemplate = `import {$validadores} from "class-validator"
import {ApiProperty, $swagger} from "@nestjs/swagger";
$import
export class Update$nameDto $padre{
$atributos
}`;

const updateMultipleDtoTemplate = `import {$validadores} from "class-validator";
import {ApiProperty, $swagger} from "@nestjs/swagger";
$import
export class UpdateMultiple$nameDto $padre {

    @IsNotEmpty()
    @ApiProperty({ description: 'id de la $name', example: 1 })
    id: number

    $atributos
}`;

const readDtoTemplate = `import {ApiProperty, $swagger} from "@nestjs/swagger";
$import
$herencia
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
            atributoStr = ` ${atributo.nombreAtributo}: ${tipo};`;
            break;
        case 'esOpcional':
            atributoStr = ` ${atributo.nombreAtributo}?: ${tipo};`;
            break;
        case 'esNulo':
        default:
            atributoStr = ` ${atributo.nombreAtributo}: ${tipo} | null;`;
            break;
    }
    
    // Validadores según tipo de dato
    switch (atributo.tipoDato) {
        case 'string':
            validadores.push('IsString');
            codigoValidadores += ` @IsString({message: 'El atributo ${atributo.nombreAtributo} debe de ser un string'})\n`;
            break;
        case 'number':
            validadores.push('IsNumber');
            codigoValidadores += ` @IsNumber({},{message: 'El atributo ${atributo.nombreAtributo} debe de ser un number'})\n`;
            break;
        case 'date':
            validadores.push('IsDate');
            codigoValidadores += ` @IsDate({message: 'El atributo ${atributo.nombreAtributo} debe de ser formato válido'})\n    @Type(() => Date)\n`;
            break;
        case 'boolean':
            validadores.push('IsBoolean');
            codigoValidadores += ` @IsBoolean({message: 'El atributo ${atributo.nombreAtributo} debe de ser un boolean'})\n`;
            break;
        case 'string[]':
        case 'number[]':
        case 'date[]':
        case 'boolean[]':
        case 'any[]':
        case 'dto[]':
            validadores.push('IsArray');
            codigoValidadores += ` @IsArray({message: 'El atributo ${atributo.nombreAtributo} debe de ser un arreglo'})\n`;
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

export async function POST(req: NextRequest) {
    try {
        const { dtoName, atributos, basePath, modo } = await req.json();

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
            // Modo CRUD - crear 4 DTOs
            // TODO: Implementar generación CRUD basada en entidad
            return NextResponse.json({ 
                error: 'Modo CRUD aún no implementado' 
            }, { status: 501 });
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el DTO: ${message}` 
        }, { status: 500 });
    }
}
