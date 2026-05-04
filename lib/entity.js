const inquirer = require('inquirer');
inquirer.registerPrompt('search-list', require('inquirer-search-list'));
const chalk = require('chalk');
const pathBase = process.cwd();
const fs = require("fs");
let {genericEntity, genericNomencladorEntity} = require("../template/entity.template");
let templateManyToOne = require("../template/many-to-one.template");
let templateOneToOne = require("../template/one-to-one.template");
let templateOneToMany = require("../template/one-to-many.template");
let {destino, origen} = require("../template/many-to-many.template");
const ruta = require('path');
const {
    buscarFichero,
    eliminarDuplicado,
    escribirFichero,
    escribirIndex, preguntar, eliminarSufijo, escapeRegExp, formatearNombre, aInicialMinuscula,
    generarColumna, direccionClassBusquedaInterna, entidades, entidadesR, esquemas, quitarSeparador,
    formatearArchivos, transformar, descompilarScript, inyectarAtributos, inyectarImportaciones, compileScript,
    inyectarParametrosEnConstructor
} = require("../util/util");
const {parse} = require("../util/parseEntity");
const {parseM} = require("../util/parseModule");
const {parseN} = require("../util/parseNomencladorRepository");
let pathTmp = '';

const relacion = {
    when: function (response) {
        relation = response.tipoDato === "relation";
        return relation;
    },
    type: "search-list",
    choices: entidadesR,
    name: 'rEntity',
    message: 'Nombre de la entidad:',
    // validate: async (input) => {
    //     await new Promise((r) => setTimeout(r, 1000));
    //     if (input === "") {
    //         console.log(chalk.bold.red("\nTiene que escribir el nombre de la entidad."));
    //         return;
    //     }
    //     let nombre = eliminarSufijo(input, 'Entity');
    //     let nombreEntity = `${formatearNombre(nombre, '-')}.entity.ts`;
    //     let esta = buscarFichero(nombreEntity);
    //     if (!esta) {
    //         console.log(chalk.bold.red("\nNo existe esa entidad."));
    //         return;
    //     }
    //     return true;
    // }
};
const newEntity = [
    {
        name: "entityName",
        type: "input",
        message: "Escribe el nombre de la entidad:",
        validate: async (input) => {
            let esta = await existeFichero(input);
            if (esta) {
                console.log(chalk.bold.red("\nYa existe esa entidad en este módulo."));
                return;
            }
            return true;
        },
    },
    {
        name: "esquema",
        type: "search-list",
        choices: esquemas,
        pageSize: esquemas.length,
        message: "Escribe el nombre del esquema:",
        // default: "Dejar en blanco para utilizar el esquema public",
        // filter: (input) => {
        //     if (input === "Dejar en blanco para utilizar el esquema public") {
        //         return "public";
        //     }
        //     return input;
        // }

    }
];
const newNomenclador = [
    {
        name: "entityName",
        type: "input",
        message: "Escribe el nombre de la entidad:",
        validate: async (input) => {
            let esta = await existeFichero(input);
            if (esta) {
                console.log(chalk.bold.red("\nYa existe esa entidad en este módulo."));
                return;
            }
            return true;
        },
    },
    {
        name: "esquema",
        type: "search-list",
        choices: esquemas,
        pageSize: esquemas.length,
        message: "Escribe el nombre del esquema:",
    }
];
const incorporarAttr = [
    {
        name: "entityName",
        type: "search-list",
        choices: entidades,
        pageSize: entidades.length,
        message: "Escribe el nombre de la entidad:",
        // validate: async (input) => {
        //     let esta = await existeFichero(input);
        //     if (!esta) {
        //         console.log(chalk.bold.red("\nNo existe esa entidad en este módulo."));
        //         return;
        //     }
        //     return true;
        // },
    }
];

const pregEntity = [
    {
        type: "list",
        name: "pregEntity",
        message: "¿Que desea hacer?",
        choices: [
            {
                value: "newEntity",
                name: "Crear una nueva entity",
            },
            {
                value: "incorporarAtrib",
                name: "Incorporar atributos a una entidad",
            },
            {
                value: "newNomenclador",
                name: "Crear un nomenclador",
            },
        ],
    },
];
let relation = false;
const questions = [
    {
        type: "input",
        name: "nombreAtributo",
        message: "Nombre del atributo:",
        validate: async (input) => {
            await new Promise((r) => setTimeout(r, 1000));
            if (input === "") {
                // Pass the return value in the done callback
                console.log(chalk.bold.red("\nTiene que escribir un nombre."));
                return;
            }
            return true;
        },
    },
    {
        type: "list",
        name: "tipoDato",
        message: "Tipo de dato:",
        pageSize: 7,
        choices: [
            "string",
            "number",
            "Date",
            "Timestamp",
            "boolean",
            "Geometry",
            "relation"
        ],
    },
    {
        when: function (response) {
            return response.tipoDato === "string";
        },
        type: "number",
        name: "length",
        message: "Escriba la longitud de la cadena:",
        default: "Dejar en blanco si es un texto"
    },
    {
        when: function (response) {
            return response.tipoDato === "number";
        },
        type: "confirm",
        name: "integer",
        message: "¿Es un número entero (Presione enter para Si)?",
        default: true,
    },
    relacion,
    {
        when: function () {
            return relation === true;
        },
        type: "list",
        name: "tipoRelacion",
        message: "Tipo de relación:",
        pageSize: 4,
        choices: [
            "OneToOne",
            "OneToMany",
            "ManyToOne",
            "ManyToMany"
        ],
    },
    {
        when: function () {
            return relation === false;
        },
        type: "confirm",
        name: "nulo",
        message: "¿Acepta nulo (Presione enter para NO)?",
        default: false,
    },
    {
        when: function () {
            return relation === false;
        },
        type: "confirm",
        name: "unico",
        message: "¿Es unico (Presione enter para NO)?",
        default: false,
    },
    {
        type: "confirm",
        name: "askAgain",
        message: "¿Desea crear otro atributo (Presione enter para YES)?",
        default: true,
    },
];
const questionsIncorporar = [
    {
        type: "input",
        name: "nombreAtributo",
        message: "Nombre del atributo:",
        validate: async (input) => {
            await new Promise((r) => setTimeout(r, 1000));
            if (input === "") {
                // Pass the return value in the done callback
                console.log(chalk.bold.red("\nTiene que escribir un nombre."));
                return;
            }
            //validar que no exista ese atributo
            const parseFile = parse(filePath);
            const clase = parseFile.find((item) => item.type === 'class');
            for (const atributo of clase.attributes) {
                if (atributo.name === input) {
                    console.log(chalk.bold.red("\nEl atributo ya existe."));
                    return;
                }
            }

            return true;
        },
    },
    {
        type: "list",
        name: "tipoDato",
        message: "Tipo de dato:",
        pageSize: 7,
        choices: [
            "string",
            "number",
            "Date",
            "Timestamp",
            "boolean",
            "Geometry",
            "relation"
        ],
    },
    {
        when: function (response) {
            return response.tipoDato === "string";
        },
        type: "number",
        name: "length",
        message: "Escriba la longitud de la cadena:",
        default: "Dejar en blanco si es un texto"
    },
    {
        when: function (response) {
            return response.tipoDato === "number";
        },
        type: "confirm",
        name: "integer",
        message: "¿Es un número entero (Presione enter para Si)?",
        default: true,
    },
    relacion,
    {
        when: function () {
            return relation === true;
        },
        type: "list",
        name: "tipoRelacion",
        message: "Tipo de relación:",
        pageSize: 4,
        choices: [
            "OneToOne",
            "OneToMany",
            "ManyToOne",
            "ManyToMany"
        ],
    },
    {
        when: function () {
            return relation === false;
        },
        type: "confirm",
        name: "nulo",
        message: "¿Acepta nulo (Presione enter para NO)?",
        default: false,
    },
    {
        when: function () {
            return relation === false;
        },
        type: "confirm",
        name: "unico",
        message: "¿Es unico (Presione enter para NO)?",
        default: false,
    },
    {
        type: "confirm",
        name: "askAgain",
        message: "¿Desea crear otro atributo (Presione enter para YES)?",
        default: true,
    },
];

const createNewEntity = async (entity) => {
    let path = ruta.normalize(`${pathBase}/src/persistence`);

    let folderPath = ruta.normalize(`${path}/entity`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    let filePath = ruta.normalize(`${folderPath}/${formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-')}.entity.ts`);
    const answers = await preguntar(questions);

    let importaciones = [];
    let atributo = '';
    let atributos = [];
    let pendiente = [];
    let entidad = formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '_');
    let esquema = entity.esquema;
    let direccion = '';
    let nombre = '';
    let typeorm = [];
    let atrConst = [];
    try {
        procesarPreguntas(answers, importaciones, nombre, direccion, atributo, atributos, typeorm, atrConst, entity.entityName, pendiente);
        let thisAtributos = [];
        for (const atr of atrConst) {
            thisAtributos.push(transformar(atr, '%campo:%tipo', 'this.%campo=%campo;'))
        }
        importaciones = eliminarDuplicado(importaciones);
        typeorm = eliminarDuplicado(typeorm);
        if (!fs.existsSync(filePath)) {
            let templateEntity = genericEntity;
            templateEntity = templateEntity.replace("$typeorm", typeorm.toString());
            templateEntity = templateEntity.replace("$entidad", entidad);
            templateEntity = templateEntity.replace("$schema", esquema);
            templateEntity = templateEntity.replace("$atributos", atributos.join(''));
            templateEntity = templateEntity.replace("$parametros", atrConst.toString());
            templateEntity = templateEntity.replace("$thisAtributos", thisAtributos.join(''));
            templateEntity = templateEntity.replace("$nameEntity", entity.entityName);
            if (importaciones.length > 0) {
                templateEntity = templateEntity.replace("$import", importaciones.join(''));
            } else {
                templateEntity = templateEntity.replace("$import", '');
            }
            escribirFichero(filePath, templateEntity);
            filePath = ruta.normalize(`${folderPath}/index.ts`);
            let exportar = `export {${entity.entityName}} from './${formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-')}.entity';\n`;
            let importacionEntidad = `import {${entity.entityName}} from './${formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-')}.entity';\n`;
            escribirIndex(filePath, exportar);
            procesarPendientes(pendiente, importacionEntidad);
        }
        //aqui vamos a importar esa entidad en el modulo
        let modulePath = ruta.normalize(`${path}/persistence.module.ts`);
        let mod = parseM(modulePath);
        let restoClase = mod.restoClase.join('');
        if (restoClase.includes('TypeOrmModule.forFeature([')) {
            let entidades = restoClase.substring(restoClase.indexOf('TypeOrmModule.forFeature([') + 26, restoClase.indexOf('])'));
            restoClase = restoClase.replace(entidades, entidades + ', $entidad');
        } else {
            if (restoClase.includes('imports: [')) {
                let imports = restoClase.substring(restoClase.indexOf('imports: [') + 10, restoClase.indexOf('controllers:'));
                restoClase = restoClase.replace(imports, 'TypeOrmModule.forFeature([$entidad]),' + imports);
            } else {
                let imports = restoClase.substring(restoClase.indexOf('(') + 1, restoClase.indexOf(')'));
                restoClase = restoClase.replace(imports, '{ imports: [TypeOrmModule.forFeature([$entidad]),],}');
            }
            mod.import.push("import { TypeOrmModule } from '@nestjs/typeorm';");
        }
        let importar = true;
        for (let importacion of mod.import) {
            if (importacion.indexOf(`./entity'`) !== -1) {
                let parametros = importacion.substring(importacion.indexOf('{') + 1, importacion.indexOf('}'));
                mod.import[mod.import.findIndex((item) => item === importacion)] = importacion.replace(parametros, parametros + ', ' + entity.entityName);
                importar = false;
            }
        }
        if (importar) {
            mod.import.push(`import { ${entity.entityName} } from './entity';`)
        }
        restoClase = restoClase.replace("$entidad", entity.entityName);
        let module = mod.import.join('');
        module = module.concat(restoClase);
        let re = escapeRegExp(',,');
        module = module.replace(re, ',');
        escribirFichero(modulePath, module);
    } catch (err) {
        console.error(err);
    } finally {
        let name = formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-') + ".entity.ts";
        console.log(`
          -------- ACCION FINALIZADA ---------\n
          Se ha creado la entidad en el módulo\n
          - Módulo: ${chalk.blue.bold('persistence')}\n
          - Entidad: ${chalk.blue.bold(name)}\n
          ------------------------------------\n
        `);
    }
}
const createNewNomenclador = async (entity) => {
    let path = ruta.normalize(`${pathBase}/src/persistence`);

    let folderPath = ruta.normalize(`${path}/entity`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    let filePath = ruta.normalize(`${folderPath}/${formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-')}.entity.ts`);
    let entidad = formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '_');
    let esquema = entity.esquema;
    try {

        if (!fs.existsSync(filePath)) {
            let templateEntity = genericNomencladorEntity;
            templateEntity = templateEntity.replace("$entidad", entidad);
            templateEntity = templateEntity.replace("$schema", esquema);
            templateEntity = templateEntity.replace("$nameEntity", entity.entityName);

            escribirFichero(filePath, templateEntity);
            filePath = ruta.normalize(`${folderPath}/index.ts`);
            let exportar = `export {${entity.entityName}} from './${formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-')}.entity';\n`;
            escribirIndex(filePath, exportar);

        }
        let modulePath = ruta.normalize(`${path}/persistence.module.ts`);
        let mod = parseM(modulePath);
        let restoClase = mod.restoClase.join('');
        if (restoClase.includes('TypeOrmModule.forFeature([')) {
            let entidades = restoClase.substring(restoClase.indexOf('TypeOrmModule.forFeature([') + 26, restoClase.indexOf(']),'));
            if (entidades.trim() === '') {
                restoClase = restoClase.replace(entidades, '[$entidad]');
            } else {
                restoClase = restoClase.replace(entidades, entidades + ', $entidad');
            }
        } else {
            if (restoClase.includes('imports: [')) {
                let imports = restoClase.substring(restoClase.indexOf('[') + 1, restoClase.indexOf('],controllers:'));
                restoClase = restoClase.replace(imports, 'TypeOrmModule.forFeature([$entidad]),' + imports);
            } else {
                let imports = restoClase.substring(restoClase.indexOf('(') + 1, restoClase.indexOf(')'));
                restoClase = restoClase.replace(imports, '{ imports: [TypeOrmModule.forFeature([$entidad]),],}');
            }
            mod.import.push("import { TypeOrmModule } from '@nestjs/typeorm';");
        }
        let importar = true;
        for (let importacion of mod.import) {
            if (importacion.indexOf(`./entity'`) !== -1) {
                let parametros = importacion.substring(importacion.indexOf('{') + 1, importacion.indexOf('}'));
                mod.import[mod.import.findIndex((item) => item === importacion)] = importacion.replace(parametros, parametros + ', ' + entity.entityName);
                importar = false;
            }
        }
        if (importar) {
            mod.import.push(`import { ${entity.entityName} } from './entity';`)
        }
        restoClase = restoClase.replace("$entidad", entity.entityName);
        let module = mod.import.join('');
        module = module.concat(restoClase);
        let re = escapeRegExp(',,');
        module = module.replace(re, ',');
        escribirFichero(modulePath, module);

        let repositotyPath = ruta.normalize(`${path}/repository/generic-nomenclador.repository.ts`);
        let repo = parseN(repositotyPath);
        restoClase = repo.restoClase.join('\n');
        let nomencladorRepository = repo.import.join('\n');
        nomencladorRepository = nomencladorRepository.concat('\n' + restoClase);
        let parametro = '@InjectRepository(' + `${entity.entityName}` + ') protected ' + `${aInicialMinuscula(eliminarSufijo(entity.entityName, 'Entity'))}` + 'Repository: Repository<' + `${entity.entityName}` + '>,';
        nomencladorRepository = nomencladorRepository.replace("$entidad", entity.entityName);
        nomencladorRepository = nomencladorRepository.replace("$parametros", parametro);
        nomencladorRepository = nomencladorRepository.replace(re, ',');
        escribirFichero(repositotyPath, nomencladorRepository);

        let enumPath = ruta.normalize(`${pathBase}/src/shared/enum/nomenclador-type.enum.ts`);
        let fichero = fs.readFileSync(enumPath, 'utf8');
        let parametros = fichero.substring(fichero.indexOf('{') + 1, fichero.indexOf('}'));
        if (parametros.trim() === '') {
            let parametros = fichero.substring(fichero.indexOf('{'), fichero.indexOf('}') + 1);
            fichero = fichero.replace(parametros, `{${eliminarSufijo(entity.entityName, 'Entity').toUpperCase()}` + ' = ' + `'${aInicialMinuscula(eliminarSufijo(entity.entityName, 'Entity'))}'` + ',}');
        } else {
            fichero = fichero.replace(parametros, parametros + `${eliminarSufijo(entity.entityName, 'Entity').toUpperCase()}` + ' = ' + `'${aInicialMinuscula(eliminarSufijo(entity.entityName, 'Entity'))}'` + ',');
        }

        escribirFichero(enumPath, fichero);
    } catch (err) {
        console.error(err);
    } finally {
        let name = formatearNombre(eliminarSufijo(entity.entityName, 'Entity'), '-') + ".entity.ts";
        console.log(`
          -------- ACCION FINALIZADA ---------\n
          Se ha creado el nomenclador en el módulo\n
          - Módulo: ${chalk.blue.bold('persistence')}\n
          - Entidad: ${chalk.blue.bold(name)}\n
          ------------------------------------\n
        `);
    }
}
let filePath = '';
const incorporarAttrEntity = async (entity) => {
    let path = ruta.normalize(`${pathBase}/src/persistence`);
    let folderPath = ruta.normalize(`${path}/entity`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    filePath = ruta.normalize(`${folderPath}/${entity.entityName}.entity.ts`);
    let entidad = '';
    if (fs.existsSync(filePath)) {
        entidad = parse(filePath);
    }
    const answers = await preguntar(questionsIncorporar);

    let importaciones = [];
    let atributo = '';
    let atributos = [];
    let pendiente = [];
    let direccion = '';
    let nombre = '';
    let typeorm = [];
    let atrConst = [];
    try {
        procesarPreguntas(answers, importaciones, nombre, direccion, atributo, atributos, typeorm, atrConst, quitarSeparador(entity.entityName, '-') + 'Entity', pendiente);
        let parametros = [];
        for (const atr of atrConst) {
            let tmp = atr.split(':');
            parametros.push({name: tmp[0], type: tmp[1].trim()})
        }
        entidad = inyectarParametrosEnConstructor(entidad, parametros);
        for (const atr of atributos) {
            entidad = inyectarAtributos(entidad, atr);
        }

        importaciones = eliminarDuplicado(importaciones);
        for (const importacion of importaciones) {
            let importarObj = descompilarScript(importacion);
            entidad = inyectarImportaciones(entidad, importarObj[0].modules, importarObj[0].path);
        }
        let pos = 0;
        let modules = [];
        if (typeorm.length > 0) {
            for (const element of entidad) {
                if (element.hasOwnProperty('path') && element.path.includes('typeorm')) {
                    modules = element.modules.split(',')
                    modules = modules.concat(typeorm);
                    modules = eliminarDuplicado(modules);
                    element.modules = modules.toString();
                    entidad[pos] = element;
                } else {
                    pos++;
                }
            }
        }
        const fichero = compileScript(entidad);
        escribirFichero(filePath, fichero);
        await formatearArchivos();
        let importacionEntidad = `import {${quitarSeparador(entity.entityName, '-')}Entity} from './${entity.entityName}.entity';\n`;

        procesarPendientes(pendiente, importacionEntidad);

    } catch (err) {
        console.error(err);
    } finally {
        let name = aInicialMinuscula(eliminarSufijo(entity.entityName, 'Entity')) + ".entity.ts";
        console.log(`
          -------- ACCION FINALIZADA ---------\n
          Se ha actualizado la entidad en el módulo\n
          - Módulo: ${chalk.blue.bold('persistence')}\n
          - Entidad: ${chalk.blue.bold(name)}\n
          ------------------------------------\n
        `);
    }
}
const entity = async () => {
    console.log("\n");
    console.log(chalk.bold.green("================"));
    console.log(chalk.bold.green("Crear una entity"));
    console.log(chalk.bold.green("================"));
    const opt = await inquirer.prompt(pregEntity);
    switch (opt.pregEntity) {
        case "newEntity":
            const entity = await inquirer.prompt(newEntity);
            await createNewEntity(entity);
            break;
        case "incorporarAtrib":
            const incorporar = await inquirer.prompt(incorporarAttr);
            await incorporarAttrEntity(incorporar);
            break;
        case "newNomenclador":
            const nomenclador = await inquirer.prompt(newNomenclador);
            await createNewNomenclador(nomenclador);
            break;
    }
};
const procesarPendientes = (pendiente, importacionEntidad) => {
    if (pendiente.length > 0) {
        for (const entidad of pendiente) {
            let importarObj = descompilarScript(importacionEntidad);
            let dir = direccionClassBusquedaInterna(entidad[0]);
            let parseFile = parse(dir);
            let modules = [];
            let pos = 0;
            if (entidad[1].includes('@OneToMany')) {
                for (const element of parseFile) {
                    if (element.hasOwnProperty('path') && element.path.includes('typeorm')) {
                        modules = element.modules.split(',')
                        modules.push('OneToMany');
                        modules = eliminarDuplicado(modules);
                        element.modules = modules.toString();
                        parseFile[pos] = element;
                    } else {
                        pos++;
                    }
                }
            }
            pos = 0;
            if (entidad[1].includes('@ManyToOne')) {
                for (const element of parseFile) {
                    if (element.hasOwnProperty('path') && element.path.includes('typeorm')) {
                        modules = element.modules.split(',')
                        modules.push('ManyToOne');
                        modules.push('JoinColumn');
                        modules = eliminarDuplicado(modules);
                        element.modules = modules.toString();
                        parseFile[pos] = element;
                    } else {
                        pos++;
                    }
                }
            }
            pos = 0;
            if (entidad[1].includes('@ManyToMany')) {
                for (const element of parseFile) {
                    if (element.hasOwnProperty('path') && element.path.includes('typeorm')) {
                        modules = element.modules.split(',')
                        modules.push('ManyToMany');
                        modules.push('JoinColumn');
                        modules = eliminarDuplicado(modules);
                        element.modules = modules.toString();
                        parseFile[pos] = element;
                    } else {
                        pos++;
                    }
                }
            }
            parseFile = inyectarImportaciones(parseFile, importarObj[0].modules, importarObj[0].path);
            parseFile = inyectarAtributos(parseFile, entidad[1]);
            let fichero = compileScript(parseFile);
            let re = escapeRegExp(',,');
            fichero = fichero.replace(re, ',');
            escribirFichero(dir, fichero);
        }
    }
}
const existeFichero = async (input) => {
    await new Promise((r) => setTimeout(r, 1000));
    if (input === "") {
        console.log(chalk.bold.red("\nTiene que escribir el nombre de la entidad."));
        return false;
    }
    let nombre = eliminarSufijo(input, 'Entity');
    let nombreEntity = `${formatearNombre(nombre, '-')}.entity.ts`;
    return buscarFichero(ruta.normalize(`${pathTmp}/entity/${nombreEntity}`));
}
const procesarPreguntas = (answers, importaciones, nombre, direccion, atributo, atributos, typeorm, atrConst, entityName, pendiente) => {
    answers.map((answer) => {
        if (answer.tipoDato === "relation") {
            typeorm.push(answer.tipoRelacion);
            let entidad = formatearNombre(eliminarSufijo(answer.rEntity, 'Entity'), '_');
            let name = formatearNombre(eliminarSufijo(entityName, 'Entity'), '_');
            if (name !== entidad) {
                nombre = formatearNombre(eliminarSufijo(answer.rEntity, 'Entity'), '-');
                if (buscarFichero(nombre)) {
                    direccion = direccionClassBusquedaInterna(answer.rEntity);
                }
                importaciones.push(`import { ${answer.rEntity} } from './${nombre}.entity';\n`);

            }
            if (answer.tipoRelacion === "ManyToOne" || answer.tipoRelacion === "OneToOne") {
                atributo = answer.nombreAtributo + ': ' + answer.rEntity + ';';
                atrConst.push(answer.nombreAtributo + ': ' + answer.rEntity);
            } else if (answer.tipoRelacion === "ManyToMany" || answer.tipoRelacion === "OneToMany") {
                atributo = answer.nombreAtributo + ': ' + answer.rEntity + '[];';
                atrConst.push(answer.nombreAtributo + ': ' + answer.rEntity + '[]');
            }

            let relacionOrigen = origen;
            let relacionDestino = destino;
            let relacionOne = templateOneToOne;
            let relacionMeny = templateManyToOne;
            let relacionOneDestino = templateOneToMany;
            let relacionOneOrigen = templateOneToMany;
            let relacionMenyDestino = templateManyToOne;
            switch (answer.tipoRelacion) {
                case "ManyToMany":
                    typeorm.push("JoinTable");
                    relacionOrigen = relacionOrigen.replace('$atributo', atributo);
                    relacionOrigen = relacionOrigen.replace('$entity', answer.rEntity);
                    relacionOrigen = relacionOrigen.replace(escapeRegExp('$name'), name);
                    relacionOrigen = relacionOrigen.replace(escapeRegExp('$entidad'), entidad);
                    relacionOrigen = relacionOrigen.replace('$nAtributos', name + 's');
                    atributos.push(relacionOrigen);

                    //analizar como trabajar para la otra entidad.
                    relacionDestino = relacionDestino.replace('$entity', entityName);
                    relacionDestino = relacionDestino.replace(escapeRegExp('$entidad'), name);
                    relacionDestino = relacionDestino.replace('$nAtributo', answer.nombreAtributo);
                    relacionDestino = relacionDestino.replace('$atributo', aInicialMinuscula(eliminarSufijo(entityName, 'Entity')) + 's: ' + entityName + '[];');
                    pendiente.push([answer.rEntity, relacionDestino, 'ManyToMany, JoinColumn']);
                    break;
                case "OneToOne":
                    typeorm.push("JoinColumn");
                    relacionOne = relacionOne.replace('$atributo', atributo);
                    relacionOne = relacionOne.replace('$entity', answer.rEntity);
                    relacionOne = relacionOne.replace('$name', entidad);
                    atributos.push(relacionOne);
                    break;
                case "ManyToOne":
                    typeorm.push("JoinColumn");
                    relacionMeny = relacionMeny.replace('$atributo', atributo);
                    relacionMeny = relacionMeny.replace('$entity', answer.rEntity);
                    relacionMeny = relacionMeny.replace(escapeRegExp('$name'), entidad);
                    relacionMeny = relacionMeny.replace('$nAtributos', aInicialMinuscula(eliminarSufijo(entityName, 'Entity')) + 's');
                    atributos.push(relacionMeny);

                    relacionOneDestino = relacionOneDestino.replace('$entity', entityName);
                    relacionOneDestino = relacionOneDestino.replace(escapeRegExp('$name'), name);
                    relacionOneDestino = relacionOneDestino.replace('$nAtributo', answer.nombreAtributo);
                    relacionOneDestino = relacionOneDestino.replace('$atributo', aInicialMinuscula(eliminarSufijo(entityName, 'Entity')) + 's: ' + entityName + '[];');
                    pendiente.push([answer.rEntity, relacionOneDestino, 'OneToMany']);
                    break;
                case "OneToMany":
                    relacionOneOrigen = relacionOneOrigen.replace('$entity', answer.rEntity);
                    relacionOneOrigen = relacionOneOrigen.replace(escapeRegExp('$name'), entidad);
                    relacionOneOrigen = relacionOneOrigen.replace('$nAtributo', aInicialMinuscula(eliminarSufijo(entityName, 'Entity')));
                    relacionOneOrigen = relacionOneOrigen.replace('$atributo', atributo);
                    atributos.push(relacionOneOrigen);

                    relacionMenyDestino = relacionMenyDestino.replace('$atributo', aInicialMinuscula(eliminarSufijo(entityName, 'Entity')) + ': ' + entityName + ';');
                    relacionMenyDestino = relacionMenyDestino.replace('$entity', entityName);
                    relacionMenyDestino = relacionMenyDestino.replace(escapeRegExp('$name'), name);
                    relacionMenyDestino = relacionMenyDestino.replace('$nAtributos', answer.nombreAtributo);
                    pendiente.push([answer.rEntity, relacionMenyDestino, 'ManyToOne, JoinColumn']);
                    break;
            }
        } else {
            atributo = generarColumna(answer);
            atributos.push(atributo);
            atrConst.push(answer.nombreAtributo + ': ' + answer.tipoDato);
        }
    });
    importaciones = eliminarDuplicado(importaciones);
}
module.exports = {entity};
