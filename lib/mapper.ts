const inquirer = require('inquirer');
const chalk = require('chalk');
const pathBase = process.cwd();
let {mepperSinRelacion, mepperRelacion} = require("../template/mapper.template");
const {
    escribirFichero, escribirIndex, escapeRegExp, quitarSeparador, aInicialMinuscula, busquedaInterna,
    direccionFichero, eliminarDuplicado, findElemento, removeFromArr, formatearNombre, formatearNombreEliminarSufijo,
    aInicialMayuscula, eliminarSufijo
} = require("../util/util");
const fs = require("fs");
const {preguntaBase} = require("../template/preguntaBase");
const ruta = require("path");
const {parse} = require("../util/parseEntity");
let importacion = [];
let repositorios = [];
const esNomenclador = {
    type: "confirm",
    name: "esNomenclador",
    message: "¿Es un nomenclador?",
    default: false,
};
const createMapper = async (mapper) => {
    let path = ruta.normalize(`${pathBase}/src/core`);
    let folderPath = ruta.normalize(`${path}/mapper`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    let filePath = ruta.normalize(`${folderPath}/${mapper.entityName}.mapper.ts`);
    let nombre = quitarSeparador(mapper.entityName, '-');
    try {
        fs.writeFileSync(filePath, '');
        let templateMapper = '';
        if (tieneRelaciones(mapper.entityName)) {
            templateMapper = mepperRelacion;
            //primera funcion
            templateMapper = templateMapper.replace('$atributos', atributos(mapper).join(''));
            templateMapper = templateMapper.replace('$analisisDtoToEntity', analisisDtoToEntity(mapper.entityName).join(''));
            templateMapper = templateMapper.replace('$parametrosDtoToEntity', parametrosDtoToEntity(mapper.entityName).toString());
            //segunda funcion
            templateMapper = templateMapper.replace('$analisisDtoToUpdateEntity', analisisDtoToUpdateEntity(mapper.entityName).join(''));
            //tercera funcion
            templateMapper = templateMapper.replace('$analisisEntityToDto', analisisEntityToDto(mapper.entityName).join(''));
            templateMapper = templateMapper.replace('$parametrosEntityToDto', parametrosEntityToDto(mapper.entityName).toString());
            if (repositorios.length > 0) {
                templateMapper = templateMapper.replace('$repositorios', repositorios.toString());
            } else {
                templateMapper = templateMapper.replace('$repositorios', '');
            }
            if (importacion.length > 0) {
                templateMapper = templateMapper.replace('$import', importacion.join(''));
            } else {
                templateMapper = templateMapper.replace('$import', '');
            }
        } else {
            templateMapper = mepperSinRelacion;
            //primera funcion
            templateMapper = templateMapper.replace('$parametrosDtoToEntity', parametrosDtoToEntity(mapper.entityName).toString());
            //segunda funcion
            templateMapper = templateMapper.replace('$analisisDtoToUpdateEntity', analisisDtoToUpdateEntity(mapper.entityName).join(''));
            //tercera funcion
            templateMapper = templateMapper.replace('$parametrosEntityToDto', parametrosEntityToDto(mapper.entityName).toString());
        }

        let re = escapeRegExp('$name');
        templateMapper = templateMapper.replace(re, nombre);
        re = escapeRegExp('$attrName');
        templateMapper = templateMapper.replace(re, aInicialMinuscula(nombre));
        escribirFichero(filePath, templateMapper);
        filePath = ruta.normalize(`${folderPath}/index.ts`);
        let exportar = `export {${nombre}Mapper} from './${mapper.entityName}.mapper';\n`;
        escribirIndex(filePath, exportar);
        let servicePath = ruta.normalize(`${path}/core.service.ts`);
        let fichero = fs.readFileSync(servicePath, 'utf8');
        let parametros = fichero.substring(fichero.indexOf(`} from './mapper'`));
        fichero = fichero.replace(parametros, quitarSeparador(mapper.entityName, '-') + 'Mapper,' + parametros.trim());
        parametros = fichero.substring(fichero.indexOf('[') + 1, fichero.indexOf(']'));
        fichero = fichero.replace(parametros, parametros.trim() + ', ' + quitarSeparador(mapper.entityName, '-') + 'Mapper,');
        re = escapeRegExp(',,');
        fichero = fichero.replace(re, ',');
        escribirFichero(servicePath, fichero);
    } catch (err) {
        console.error(err);
    } finally {
        let nameMapper = mapper.entityName + ".mapper.ts";
        console.log(`
        ---------- ACCION FINALIZADA -----------\n
        Se ha creado el mapper en el módulo\n
        - Módulo: ${chalk.blue.bold('core')}\n
        - Mapper: ${chalk.blue.bold(nameMapper)}\n
        ----------------------------------------\n
      `);
    }
}

const mapper = async () => {
    console.log("\n");
    console.log(chalk.bold.green("==================="));
    console.log(chalk.bold.green("Crear un mapper"));
    console.log(chalk.bold.green("==================="));

    let mapper = await inquirer.prompt(await preguntaBase(esNomenclador));
    await createMapper(mapper);

};

const atributos = (mapper) => {
    let rutaEntity = ruta.normalize(`${pathBase}/src/persistence/entity/${mapper.entityName}.entity.ts`);
    let entity = parse(rutaEntity);
    let clase = entity.find((item) => item.type === 'class');
    let atributosR = clase.attributes.filter((item) => item.kind.includes('Entity'));
    let rutaNomenclador = ruta.normalize(direccionFichero("nomenclador-type.enum.ts"));
    let atributos = [];
    let impMapper = [];
    let impEntity = [];
    let impDto = [];
    for (const item of atributosR) {
        if (!item.relation.includes('OneToMany')) {
            const entidad = aInicialMinuscula(eliminarSufijo(item.kind, 'Entity'));
            let esNomenclador = busquedaInterna(rutaNomenclador, entidad);
            if (esNomenclador && !atributos.includes('protected nomencladorGenericRepository: GenericNomencladorRepository,')) {
                if (mapper.esNomenclador) {
                    impDto.push(`ReadNomencladorDto`);
                    importacion.push(`
                import {GenericNomencladorRepository} from "../../persistence/repository";
                import {GenericNomencladorMapper} from "./generic-nomenclador.mapper";
                import {NomencladorTypeEnum} from "../../shared/enum";`);
                } else {
                    importacion.push(`import {ReadNomencladorDto} from "../../shared/dto";
                import {GenericNomencladorRepository} from "../../persistence/repository";
                import {GenericNomencladorMapper} from "./generic-nomenclador.mapper";
                import {NomencladorTypeEnum} from "../../shared/enum";`);
                }
                atributos.push('protected nomencladorGenericRepository: GenericNomencladorRepository,');
                atributos.push('protected nomencladorGenericMapper: GenericNomencladorMapper,');
            } else {
                atributos.push(`protected ${entidad}Repository: ${aInicialMayuscula(entidad)}Repository,`);
                atributos.push(`protected ${entidad}Mapper: ${aInicialMayuscula(entidad)}Mapper,`);
                impMapper.push(aInicialMayuscula(entidad) + 'Mapper');
            }
            impEntity.push(`${aInicialMayuscula(entidad)}Entity`);
        }
    }
    if (impMapper.length > 0) {
        for (const mapper of impMapper) {
            importacion.push(`import {${mapper}} from './${formatearNombreEliminarSufijo(mapper, 'Mapper', '-')}.mapper';`);
        }

    }
    if (impEntity.length > 0) {
        importacion.push(`import {${impEntity.toString()}} from "../../persistence/entity";`);
    }
    if (impDto.length > 0) {
        importacion.push(`import {${impDto.toString()}} from "../../shared/dto";`);
    }
    importacion = eliminarDuplicado(importacion);
    return eliminarDuplicado(atributos);
}
const analisisDtoToEntity = (entityName) => {
    let rutaEntity = ruta.normalize(`${pathBase}/src/persistence/entity/${entityName}.entity.ts`);
    let entity = parse(rutaEntity);
    let clase = entity.find((item) => item.type === 'class');
    let atributosR = clase.attributes.filter((item) => item.kind.includes('Entity'));
    let rutaNomenclador = ruta.normalize(direccionFichero("nomenclador-type.enum.ts"));
    let analisisDtoToEntity = [];
    let entidad = '';

    for (const item of atributosR) {
        if (!item.relation.includes('OneToMany')) {
            entidad = aInicialMinuscula(eliminarSufijo(item.kind, 'Entity'));
            let esNomenclador = busquedaInterna(rutaNomenclador, entidad);
            if (item.relation === '@ManyToOne' || item.relation === '@OneToOne') {
                if (esNomenclador) {
                    analisisDtoToEntity.push(`const ${item.name}:${aInicialMayuscula(entidad) + 'Entity'} = await this.nomencladorGenericRepository.findById(NomencladorTypeEnum.${entidad.toLocaleUpperCase()}, create$nameDto.${item.name});`);
                } else {
                    analisisDtoToEntity.push(`const ${item.name}:${aInicialMayuscula(entidad) + 'Entity'} = await this.${entidad}Repository.findById(create$nameDto.${item.name});`);
                }
            }
            if (item.relation === '@ManyToMany') {
                if (esNomenclador) {
                    analisisDtoToEntity.push(`const ${item.name}:${aInicialMayuscula(entidad) + 'Entity[]'} = await this.nomencladorGenericRepository.findByIds(NomencladorTypeEnum.${entidad.toLocaleUpperCase()}, create$nameDto.${item.name});`);
                } else {
                    analisisDtoToEntity.push(`const ${item.name}:${aInicialMayuscula(entidad) + 'Entity[]'} = await this.${entidad}Repository.findByIds(create$nameDto.${item.name});`);
                }
            }
            entidad = '';
        }
    }
    return analisisDtoToEntity;
}
const parametrosDtoToEntity = (entityName) => {
    let rutaEntity = ruta.normalize(`${pathBase}/src/persistence/entity/${entityName}.entity.ts`);
    let entity = parse(rutaEntity);
    let clase = entity.find((item) => item.type === 'class');
    let parametrosDtoToEntity = [];
    for (const parametro of clase.attributes) {
        if (parametro.relation === undefined || !parametro.relation.includes('OneToMany')) {
            if (parametro.kind.includes('Entity')) {
                parametrosDtoToEntity.push(parametro.name.split('?')[0]);
            } else {
                parametrosDtoToEntity.push(`create$nameDto.${parametro.name.split('?')[0]}`)
            }
        }
    }
    return parametrosDtoToEntity;
}
const analisisDtoToUpdateEntity = (entityName) => {
    let rutaEntity = ruta.normalize(`${pathBase}/src/persistence/entity/${entityName}.entity.ts`);
    let entity = parse(rutaEntity);
    let clase = entity.find((item) => item.type === 'class');
    let atributosR = clase.attributes.filter((item) => item.kind.includes('Entity'));
    let rutaNomenclador = ruta.normalize(direccionFichero("nomenclador-type.enum.ts"));
    let analisisDtoToUpdateEntity = [];
    let entidad = '';
    for (const item of atributosR) {
        entidad = aInicialMinuscula(eliminarSufijo(item.kind, 'Entity'));
        let esNomenclador = busquedaInterna(rutaNomenclador, entidad);
        if (item.relation === '@ManyToOne' || item.relation === '@OneToOne') {
            if (esNomenclador) {
                analisisDtoToUpdateEntity.push(`const ${item.name.split('?')[0]}:${aInicialMayuscula(entidad) + 'Entity'} = await this.nomencladorGenericRepository.findById(NomencladorTypeEnum.${entidad.toLocaleUpperCase()}, update$nameDto.${item.name.split('?')[0]});`);
            } else {
                analisisDtoToUpdateEntity.push(`const ${item.name.split('?')[0]}:${aInicialMayuscula(entidad) + 'Entity'} = await this.${entidad}Repository.findById(update$nameDto.${item.name.split('?')[0]});`);
            }
        }
        if (item.relation === '@ManyToMany') {
            if (esNomenclador) {
                analisisDtoToUpdateEntity.push(`const ${item.name.split('?')[0]}:${aInicialMayuscula(entidad) + 'Entity[]'} = await this.nomencladorGenericRepository.findByIds(NomencladorTypeEnum.${entidad.toLocaleUpperCase()}, update$nameDto.${item.name.split('?')[0]});`);
            } else {
                analisisDtoToUpdateEntity.push(`const ${item.name.split('?')[0]}:${aInicialMayuscula(entidad) + 'Entity[]'} = await this.${entidad}Repository.findByIds(update$nameDto.${item.name.split('?')[0]});`);
            }
        }
        entidad = '';
    }

    for (const parametro of clase.attributes) {
        if (parametro.relation === undefined || !parametro.relation.includes('OneToMany')) {
            if (parametro.kind.includes('Entity')) {
                analisisDtoToUpdateEntity.push(`update$nameEntity.${parametro.name.split('?')[0]} = ${parametro.name.split('?')[0]};`);
            } else {
                analisisDtoToUpdateEntity.push(`update$nameEntity.${parametro.name.split('?')[0]} = update$nameDto.${parametro.name.split('?')[0]};`)
            }
        }
    }
    return analisisDtoToUpdateEntity;
}
const analisisEntityToDto = (entityName) => {
    let rutaEntity = ruta.normalize(`${pathBase}/src/persistence/entity/${entityName}.entity.ts`);
    let entity = parse(rutaEntity);
    let clase = entity.find((item) => item.type === 'class');
    let atributosR = clase.attributes.filter((item) => item.kind.includes('Entity'));
    let rutaNomenclador = ruta.normalize(direccionFichero("nomenclador-type.enum.ts"));
    let analisisEntityToDto = [];
    let entidad = '';
    for (const item of atributosR) {
        entidad = aInicialMinuscula(eliminarSufijo(item.kind, 'Entity'));
        let esNomenclador = busquedaInterna(rutaNomenclador, entidad);
        if (item.relation === '@ManyToOne' || item.relation === '@OneToOne') {
            if (esNomenclador) {
                analisisEntityToDto.push(`const ${item.name}: ReadNomencladorDto = await this.nomencladorGenericMapper.entityToDto($attrName.${item.name});`)
            } else {
                analisisEntityToDto.push(`const ${item.name}: Read${aInicialMayuscula(entidad)}Dto = await this.${entidad}Mapper.entityToDto($attrName.${item.name});`);
            }
        }
        if (item.relation === '@ManyToMany') {
            if (esNomenclador) {
                analisisEntityToDto.push(`const ${item.name}: ReadNomencladorDto[] = $attrName.${item.name}.map((item: ${item.kind}) => this.nomencladorGenericMapper.entityToDto(item));`);
            } else {
                analisisEntityToDto.push(`const ${item.name}: Read${aInicialMayuscula(entidad)}Dto[] = $attrName.${item.name}.map((item: ${item.kind}) => this.${entidad}Mapper.entityToDto(item));`);
            }
        }
        entidad = '';
    }
    return analisisEntityToDto;
}
const parametrosEntityToDto = (entityName) => {
    let rutaDto = ruta.normalize(`${pathBase}/src/shared/dto/read-${entityName}.dto.ts`);
    let dto = parse(rutaDto);
    let clase = dto.find((item) => item.type === 'class');
    let parametrosEntityToDto = [];
    for (const parametro of clase.attributes) {
        if (parametro.kind.includes('Dto') || parametro.name === 'dtoToString') {
            parametrosEntityToDto.push(parametro.name.split('?')[0]);
        } else {
            parametrosEntityToDto.push(`$attrNameEntity.${parametro.name.split('?')[0]}`)
        }
    }
    return parametrosEntityToDto;
}
const tieneRelaciones = (entityName) => {
    let rutaEntity = ruta.normalize(`${pathBase}/src/persistence/entity/${entityName}.entity.ts`);
    let entity = parse(rutaEntity);
    let clase = entity.find((item) => item.type === 'class');
    return clase.attributes.some((item) => !!item.relation);
}
module.exports = {mapper, createMapper};