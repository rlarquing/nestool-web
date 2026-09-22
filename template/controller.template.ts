module.exports=`import {Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards} from '@nestjs/common';
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
$import

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
    status: 404,
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
    const header: string[] = ['id', $header];
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
    const header: string[] = ['id', $header];
    const key: string[] = ['id', $header];
return new ListadoDto(header, key, data);
}
}
`;