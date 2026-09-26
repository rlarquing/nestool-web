import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

const controllerTemplate = `import {Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
import {$nameService} from '../../core/service';
import {GetUser, IpAddress, Servicio, PaginationParams} from '../decorator';
import {AuthGuard} from "@nestjs/passport";
import {$nameEntity, UserEntity} from "../../persistence/entity";
import { ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,} from "@nestjs/swagger";
import {GenericController} from "./generic.controller";
import {BadRequestDto, BuscarDto, FiltroGenericoDto, ListadoDto, ResponseDto, Create$nameDto, Read$nameDto, UpdateMultiple$nameDto, Update$nameDto} from "../../shared/dto";
import {RolGuard, PermissionGuard} from '../guard';
import {PaginationParamsDto, PaginationService} from '../../shared/pagination';

@ApiTags('$tag')
@Controller('$paraCont')
@UseGuards(AuthGuard('jwt'), RolGuard, PermissionGuard)
@ApiBearerAuth()
export class $nameController extends GenericController<$nameEntity> {
    constructor(
        protected $paramService: $nameService,
        protected paginationService: PaginationService,
    ) {
        super($paramService, paginationService, '$paraCont');
    }

@Get('/')
@ApiOperation({summary: 'Obtener el listado de elementos del conjunto'})
@ApiResponse({
    status: 200,
    description: 'Listado de elementos del conjunto',
    type: ListadoDto,
})
@ApiNotFoundResponse({
    description: 'Elementos del conjunto no encontrados.',
})
@ApiResponse({status: 401, description: 'Sin autorizacion.'})
@ApiResponse({status: 403, description: 'Sin autorizacion al recurso.'})
@ApiResponse({status: 500, description: 'Error interno del servidor.'})
@ApiQuery({ required: false, name: 'page', example: '1' })
@ApiQuery({ required: false, name: 'limit', example: '10' })
@Servicio($nServicio, 'findAll')
async findAll(@PaginationParams() params: PaginationParamsDto): Promise<any> {
    const data = await super.findAll(params);
    const header: string[] = ['id', $headerLabel];
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
async create(@GetUser() user: UserEntity, @Body() create$nameDto: Create$nameDto, @IpAddress() ip: string): Promise<ResponseDto> {
    return await super.create(user, create$nameDto, ip);
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
async createMultiple(@GetUser() user: UserEntity, @Body() create$nameDto: Create$nameDto[], @IpAddress() ip: string): Promise<ResponseDto[]> {
    return await super.createMultiple(user, create$nameDto, ip);
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
async import(@GetUser() user: UserEntity, @Body() create$nameDto: Create$nameDto[], @IpAddress() ip: string): Promise<ResponseDto[]> {
    return await super.import(user, create$nameDto, ip);
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
async update(@GetUser() user: UserEntity, @Param('id', ParseIntPipe) id: number, @Body() update$nameDto: Update$nameDto, @IpAddress() ip: string): Promise<ResponseDto> {
    return await super.update(user, id, update$nameDto, ip);
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
async updateMultiple(@GetUser() user: UserEntity, @Body() updateMultiple$nameDto: UpdateMultiple$nameDto[], @IpAddress() ip: string): Promise<ResponseDto> {
    return await super.updateMultiple(user, updateMultiple$nameDto, ip);
}

@Post('/filtrar')
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
async filter(@PaginationParams() params: PaginationParamsDto,
@Body() filtroGenericoDto: FiltroGenericoDto): Promise<any> {
    const data = await super.filter(params, filtroGenericoDto);
    const header: string[] = ['id', $headerLabel];
    const key: string[] = ['id', $header];
return new ListadoDto(header, key, data);
}
@Post('/buscar')
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
async search(@PaginationParams() params: PaginationParamsDto,
@Body() buscarDto: BuscarDto): Promise<any> {
    const data = await super.search(params, buscarDto);
    const header: string[] = ['id', $headerLabel];
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
        // La clase real siempre termina en "Entity" (así la crea crear-entidad)
        const entityClassName = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
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
        let atributos: string[] = [];
        
        if (existsSync(entityPath)) {
            const entityContent = readFileSync(entityPath, 'utf-8');
            // Extraer nombres de atributos (solo los básicos, no relaciones)
            // admite "propiedad:" "propiedad?:" y "propiedad!:" (TS estricto)
            const attributeMatches = entityContent.match(/@Column\([^)]*\)\s*\n\s*(\w+)([!?])?:/g);
            if (attributeMatches) {
                atributos = attributeMatches.map(match => {
                    const nameMatch = match.match(/@Column\([^)]*\)\s*\n\s*(\w+)([!?])?:/);
                    return nameMatch ? `'${nameMatch[1]}'` : null;
                }).filter(Boolean) as string[];
            }
        }

        // Si no encontramos atributos, usar algunos por defecto
        if (atributos.length === 0) {
            atributos = ["'nombre'", "'descripcion'"];
        }

        // F9-M1: header (etiquetas, primera letra mayúscula) separado de key
        // (claves crudas). El modelo real (idioma.controller.ts) usa
        // header=['id','Codigo','Nombre','Defecto'] vs key=['id','codigo',...].
        const headerLabels: string[] = atributos.map((attr: string) => {
            const raw = attr.replace(/'/g, '');
            return `'${raw.charAt(0).toUpperCase()}${raw.slice(1)}'`;
        });

        // Preparar template
        let template = controllerTemplate;
        template = template.replace(/\$nameService/g, serviceName);
        template = template.replace(/\$nameEntity/g, entityClassName);
        template = template.replace(/\$name/g, nombre);
        template = template.replace(/\$param/g, nombreLower);
        template = template.replace(/\$paraCont/g, nombreLower);
        template = template.replace(/\$tag/g, tag);
        template = template.replace(/\$nServicio/g, `'${nombreLower}'`);
        // ORDEN IMPORTANTE: $headerLabel ANTES que $header (si no, /\$header/
        // se come el prefijo de $headerLabel y deja basura "…'activo'Label]")
        template = template.replace(/\$headerLabel/g, headerLabels.join(', '));
        template = template.replace(/\$header/g, atributos.join(', '));

        // Escribir archivo
        writeFileSync(filePath, template);

        // Actualizar index.ts (formato con espacios, igual al de la api)
        const indexPath = path.join(entityDir, 'index.ts');
        const exportStatement = `export { ${controllerClassName} } from './${formatearNombre(nombre, '-')}.controller';\n`;
        
        if (existsSync(indexPath)) {
            const indexContent = readFileSync(indexPath, 'utf-8');
            if (!indexContent.includes(`export { ${controllerClassName} }`)) {
                writeFileSync(indexPath, indexContent + exportStatement);
            }
        } else {
            writeFileSync(indexPath, exportStatement);
        }

        // --- ACTUALIZAR api.service.ts (registro dinámico de controllers) ---
        // api.module.ts consume `export const controller = [...]` desde api.service.ts;
        // NO se debe parchear api.module.ts directamente.
        const apiServicePath = path.join(basePath, 'src/api/api.service.ts');
        if (existsSync(apiServicePath)) {
            let serviceContent = readFileSync(apiServicePath, 'utf-8');

            // 1. Agregar la clase al import existente desde './controller' si no está
            //    (el nombre SIEMPRE es el de la clase exportada: controllerClassName)
            const importRegex = /import\s*{([^}]*)}\s*from\s*['"]\.\/controller['"];?/;
            if (importRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(importRegex, (match, imports) => {
                    let importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!importList.includes(controllerClassName)) importList.push(controllerClassName);
                    importList = Array.from(new Set(importList));
                    return `import { ${importList.join(', ')} } from "./controller";`;
                });
            } else {
                serviceContent = `import { ${controllerClassName} } from "./controller";\n` + serviceContent;
            }

            // 2. Agregar al array 'controller' si no está
            const controllerArrayRegex = /export\s+const\s+controller\s*=\s*\[([^\]]*)\]/;
            if (controllerArrayRegex.test(serviceContent)) {
                serviceContent = serviceContent.replace(controllerArrayRegex, (match, items) => {
                    let itemList = items.split(',').map((i: string) => i.trim()).filter(Boolean);
                    if (!itemList.includes(controllerClassName)) itemList.push(controllerClassName);
                    itemList = Array.from(new Set(itemList));
                    return `export const controller = [${itemList.join(', ')}]`;
                });
            }

            writeFileSync(apiServicePath, serviceContent);
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
