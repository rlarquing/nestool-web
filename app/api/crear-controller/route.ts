import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const controllerTemplate = `import {Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe} from '@nestjs/common';
import {$nameService} from '../../core/service';
import {GetUser, Servicio} from "../decorator";
import {RolType} from "../../shared/enum";
import {AuthGuard} from "@nestjs/passport";
import {$nameEntity, UserEntity} from "../../persistence/entity";
import {ConfigService} from "@nestjs/config";
import { ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam, ApiQuery,
  ApiResponse,
  ApiTags,} from "@nestjs/swagger";
import {GenericController} from "./generic.controller";
import {BadRequestDto, BuscarDto, FiltroGenericoDto, ListadoDto, ResponseDto, Create$nameDto, Read$nameDto, UpdateMultiple$nameDto, Update$nameDto} from "../../shared/dto";
import {RolGuard, PermissionGuard} from '../guard';

@ApiTags('$tag')
@Controller('$paraCont')
@UseGuards(AuthGuard('jwt'), RolGuard, PermissionGuard)
@ApiBearerAuth()
@UsePipes(ValidationPipe)
export class $nameController extends GenericController<$nameEntity> {
    constructor(
        protected $paramService: $nameService,
    protected configService: ConfigService
) {
    super($paramService, configService, '$paraCont');
}

@Get('/')
@ApiOperation({summary: 'Obtener el listado de elementos del conjunto'})
@ApiResponse({
    status: 200,
    description: 'Listado de elementos del conjunto',
    type: ListadoDto,
})
@ApiNotFoundResponse({
    status: 404,
    description: 'Elementos del conjunto no encontrados.',
})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiParam({ required: false, name: 'page', example: '1' })
@ApiParam({ required: false, name: 'limit', example: '10' })
@Servicio($nServicio, 'findAll')
async findAll(
    @Query('page') page: number = 1,
@Query('limit') limit: number = 10): Promise<any> {
    const data = await super.findAll(page, limit);
    const header: string[] = ['id', $header];
    const key: string[] = ['id', $header];
return new ListadoDto(header, key, data);
}

@Get('/:id')
@ApiOperation({summary: 'Obtener un elemento del conjunto'})
@ApiResponse({
    status: 200,
    description: 'Muestra la información de un elemento del conjunto',
    type: Read$nameDto,
})
@ApiNotFoundResponse({
    status: 404,
    description: 'Elemento del conjunto no encontrado.',
})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@Servicio($nServicio, 'findById')
async findById(@Param('id', ParseIntPipe) id: number): Promise<Read$nameDto> {
    return await super.findById(id);
}

@Post('/elementos/multiples')
@ApiOperation({summary: 'Obtener multiples elementos del conjunto'})
@ApiBody({
    description: 'Estructura para mostrar los multiples elementos del conjunto.',
    type: [Number],
})
@ApiResponse({
    status: 200,
    description: 'Muestra la información de multiples elementos del conjunto',
    type: [Read$nameDto],
})
@ApiNotFoundResponse({
    status: 404,
    description: 'Elementos del conjunto no encontrados.',
})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@Servicio($nServicio, 'findByIds')
async findByIds(@Body() ids: number[]): Promise<Read$nameDto[]> {
    return await super.findByIds(ids);
}

@Post('/')
@ApiOperation({summary: 'Crear un elemento del conjunto.'})
@ApiBody({
    description: 'Estructura para crear el elemento del conjunto.',
    type: Create$nameDto,
})
@ApiResponse({status: 201, description: 'Crea un elemento del conjunto.', type: ResponseDto})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiResponse({status: 400, description: 'Solicitud con errores.',type: BadRequestDto})
@Servicio($nServicio, 'create')
async create(@GetUser() user: UserEntity, @Body() create$nameDto: Create$nameDto): Promise<ResponseDto> {
    return await super.create(user, create$nameDto);
}

@Post('/multiple')
@ApiOperation({summary: 'Crear un grupo de elementos del conjunto.'})
@ApiBody({
    description: 'Estructura para crear el grupo de elementos del conjunto.',
    type: [Create$nameDto],
})
@ApiResponse({status: 201, description: 'Crea un grupo de elementos del conjunto.', type: ResponseDto})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiResponse({status: 400, description: 'Solicitud con errores.',type: BadRequestDto})
@Servicio($nServicio, 'createMultiple')
async createMultiple(@GetUser() user: UserEntity, @Body() create$nameDto: Create$nameDto[]): Promise<ResponseDto[]> {
    return await super.createMultiple(user, create$nameDto);
}

@Post('/importar/elementos')
@ApiOperation({summary: 'Importar un grupo de elementos del conjunto.'})
@ApiBody({
    description: 'Estructura para crear el grupo de elementos del conjunto.',
    type: [Create$nameDto],
})
@ApiResponse({status: 201, description: 'Crea un grupo de elementos del conjunto.', type: ResponseDto})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiResponse({status: 400, description: 'Solicitud con errores.',type: BadRequestDto})
@Servicio($nServicio, 'importar')
async import(@GetUser() user: UserEntity, @Body() create$nameDto: Create$nameDto[]): Promise<ResponseDto[]> {
    return await super.import(user, create$nameDto);
}

@Patch('/:id')
@ApiOperation({summary: 'Actualizar un elemento del conjunto.'})
@ApiBody({
    description: 'Estructura para modificar el elemento del conjunto.',
    type: Update$nameDto,
})
@ApiResponse({status: 201, description: 'El elemento se ha actualizado.', type: ResponseDto})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiResponse({status: 400, description: 'Solicitud con errores.',type: BadRequestDto})
@Servicio($nServicio, 'update')
async update(@GetUser() user: UserEntity, @Param('id', ParseIntPipe) id: number, @Body() update$nameDto: Update$nameDto): Promise<ResponseDto> {
    return await super.update(user, id, update$nameDto);
}

@Patch('/elementos/multiples')
@ApiOperation({summary: 'Actualizar un grupo de elementos del conjunto.'})
@ApiBody({
    description: 'Estructura para modificar el grupo de elementos del conjunto.',
    type: [UpdateMultiple$nameDto],
})
@ApiResponse({status: 201, description: 'El grupo de elementos se han actualizado.', type: ResponseDto})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiResponse({status: 400, description: 'Solicitud con errores.',type: BadRequestDto})
@Servicio($nServicio, 'updateMultiple')
async updateMultiple(@GetUser() user: UserEntity, @Body() updateMultiple$nameeDto: UpdateMultiple$nameDto[]): Promise<ResponseDto> {
    return await super.updateMultiple(user, updateMultiple$nameeDto);
}

@Post('filtrar')
@ApiOperation({summary: 'Filtrar el conjunto por los parametros establecidos'})
@ApiResponse({
    status: 201,
    description: 'Filtra el conjunto por los parametros que se le puedan pasar',
    type: ListadoDto,
})
@ApiBody({
    description: 'Estructura para crear el filtrado.',
    type: FiltroGenericoDto
})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiQuery({ required: false, name: 'page', example: '1' })
@ApiQuery({ required: false, name: 'limit', example: '10' })
@Servicio($nServicio, 'filter')
async filter(@Query('page') page: number = 1,
@Query('limit') limit: number = 10,
@Body() filtroGenericoDto: FiltroGenericoDto): Promise<any> {
    const data = await super.filter(page, limit, filtroGenericoDto);
    const header: string[] = ['id', $header];
    const key: string[] = ['id', $header];
return new ListadoDto(header, key, data);
}
@Post('buscar')
@ApiOperation({summary: 'Buscar en el conjunto por el parametro establecido'})
@ApiResponse({
    status: 201,
    description: 'Busca en el conjunto en el parametros establecido',
    type: ListadoDto,
})
@ApiBody({
    description: 'Estructura para crear la busqueda.',
    type: String
})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiQuery({ required: false, name: 'page', example: '1' })
@ApiQuery({ required: false, name: 'limit', example: '10' })
@Servicio($nServicio, 'search')
async search(@Query('page') page: number = 1,
@Query('limit') limit: number = 10,
@Body() buscarDto: BuscarDto): Promise<any> {
    const data = await super.search(page, limit, buscarDto);
    const header: string[] = ['id', $header];
    const key: string[] = ['id', $header];
return new ListadoDto(header, key, data);
}
}
`;

export async function POST(req: NextRequest) {
    try {
        const { entityName, basePath } = await req.json();

        if (!entityName || !basePath) {
            return NextResponse.json({ 
                error: 'entityName y basePath son requeridos' 
            }, { status: 400 });
        }

        if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
            return NextResponse.json({ 
                error: 'El nombre de la entidad debe empezar con mayúscula' 
            }, { status: 400 });
        }

        const entityDir = path.join(basePath, 'src/api/controller');
        if (!existsSync(entityDir)) {
            mkdirSync(entityDir, { recursive: true });
        }

        const nombreSinEntity = eliminarSufijo(entityName, 'Entity');
        const nombre = nombreSinEntity;
        const nombreLower = aInicialMinuscula(nombre);
        const tag = nombre + 's';
        const controllerClassName = nombre + 'Controller';
        const serviceName = nombre + 'Service';
        const fileName = `${formatearNombre(nombre, '-')}.controller.ts`;
        const filePath = path.join(entityDir, fileName);

        if (existsSync(filePath)) {
            return NextResponse.json({ 
                error: `El controller ${controllerClassName} ya existe` 
            }, { status: 409 });
        }

        // Leer la entidad para obtener los atributos
        const entityPath = path.join(basePath, `src/persistence/entity/${formatearNombre(nombreSinEntity, '-')}.entity.ts`);
        let atributos = [];
        
        if (existsSync(entityPath)) {
            const entityContent = readFileSync(entityPath, 'utf-8');
            // Extraer nombres de atributos (solo los básicos, no relaciones)
            const attributeMatches = entityContent.match(/@Column\([^)]*\)\s*\n\s*(\w+)(\??):/g);
            if (attributeMatches) {
                atributos = attributeMatches.map(match => {
                    const nameMatch = match.match(/@Column\([^)]*\)\s*\n\s*(\w+)(\??):/);
                    return nameMatch ? `'${nameMatch[1]}'` : null;
                }).filter(Boolean);
            }
        }

        // Si no encontramos atributos, usar algunos por defecto
        if (atributos.length === 0) {
            atributos = ["'nombre'", "'descripcion'"];
        }

        // Preparar template
        let template = controllerTemplate;
        template = template.replace(/\$nameService/g, serviceName);
        template = template.replace(/\$nameEntity/g, entityName);
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$param/g, nombreLower);
        template = template.replace(/\$paraCont/g, nombreLower);
        template = template.replace(/\$tag/g, tag);
        template = template.replace(/\$nServicio/g, `'${nombreLower}'`);
        template = template.replace(/\$header/g, atributos.join(', '));

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts
        const indexPath = path.join(entityDir, 'index.ts');
        const exportStatement = `export {${controllerClassName}} from './${formatearNombre(nombre, '-')}.controller';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export {${controllerClassName}}`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // Actualizar api.module.ts
        const modulePath = path.join(basePath, 'src/api/api.module.ts');
        if (existsSync(modulePath)) {
            let moduleContent = readFileSync(modulePath, 'utf-8');
            
            // Agregar import del controller si no existe
            const controllerImport = `import {${nombreLower}Controller} from './controller/${formatearNombre(nombre, '-')}.controller';`;
            if (!moduleContent.includes(controllerImport)) {
                // Insertar después del último import
                const lastImportIndex = moduleContent.lastIndexOf('import ');
                const lastImportEnd = moduleContent.indexOf('\n', lastImportIndex) + 1;
                moduleContent = moduleContent.slice(0, lastImportEnd) + controllerImport + '\n' + moduleContent.slice(lastImportEnd);
            }

            // Agregar al array de controllers
            if (!moduleContent.includes(`${nombreLower}Controller`)) {
                const controllerArrayMatch = moduleContent.match(/controllers:\s*\[([^\]]*)\]/);
                if (controllerArrayMatch) {
                    const currentArray = controllerArrayMatch[1];
                    const newArray = currentArray ? `${currentArray.trim()}, ${nombreLower}Controller` : `${nombreLower}Controller`;
                    moduleContent = moduleContent.replace(controllerArrayMatch[0], `controllers: [${newArray}]`);
                }
            }
            
            writeFileSync(modulePath, moduleContent);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Controller ${controllerClassName} creado exitosamente`,
            filePath: filePath
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al crear el controller: ${message}` 
        }, { status: 500 });
    }
}
