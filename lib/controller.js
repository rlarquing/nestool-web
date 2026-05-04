const inquirer = require('inquirer');
const chalk = require('chalk');
const pathBase = process.cwd();
let templateController = require("../template/controller.template");
const {
    escribirFichero,
    escribirIndex,
    escapeRegExp,
    quitarSeparador, aInicialMinuscula, removeFromArr
} = require("../util/util");
const fs = require("fs");
const {preguntaBase} = require("../template/preguntaBase");
const util = require("util");
const ruta = require("path");
const {parse} = require("../util/parseEntity");
const {parseM} = require("../util/parseModule");
const exec = util.promisify(require("child_process").exec);

const createController = async (controller) => {
    let path = ruta.normalize(`${pathBase}/src/api`);
    let folderPath = ruta.normalize(`${path}/controller`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    let filePath = ruta.normalize(`${folderPath}/${controller.entityName}.controller.ts`);
    let nombre = quitarSeparador(controller.entityName, '-');
    let direccion = 'api/controller';
    let stdout = await generateController(controller.entityName, direccion);
    let entityPath = ruta.normalize(`${pathBase}/src/persistence/entity/${controller.entityName}.entity.ts`);
    let entity = parse(entityPath);
    let clase = entity.find((item) => item.type === 'class');
    let atributos = clase.attributes.map((item)=>`'${item.name.split('?')[0]}'`);
    let importaciones = [];
    try {
        fs.writeFileSync(filePath, '');
        var re = escapeRegExp('$name');
        templateController = templateController.replace(re, nombre);
        re = escapeRegExp('$nServicio');
        templateController = templateController.replace(re, `'${aInicialMinuscula(quitarSeparador(nombre, '-'))}'`);
        re = escapeRegExp('$param');
        templateController = templateController.replace(re, aInicialMinuscula(quitarSeparador(controller.entityName, '-')));
        re = escapeRegExp('$paraCont');
        templateController = templateController.replace(re, controller.entityName);
        re = escapeRegExp('$tag');
        templateController = templateController.replace(re, quitarSeparador(nombre) + 's'
        );
        if (importaciones.length > 0) {
            templateController = templateController.replace("$import", importaciones.join(''));
        } else {
            templateController = templateController.replace("$import", '');
        }
        var re = escapeRegExp('$header');
        templateController = templateController.replace(re, atributos.toString());
       escribirFichero(filePath, templateController);
        filePath = ruta.normalize(`${folderPath}/index.ts`);
        let exportar = `export {${nombre}Controller} from './${controller.entityName}.controller';\n`;
       escribirIndex(filePath, exportar);

        let modulePath = ruta.normalize(`${path}/api.module.ts`);
        let mod = parseM(modulePath);
        let restoClase = mod.restoClase.join('');
        for (let importacion of mod.import) {
            if (importacion.indexOf(`./controller'`) !== -1) {
                let parametros = importacion.substring(importacion.indexOf('{') + 1, importacion.indexOf('}'));
                mod.import[mod.import.findIndex((item) => item === importacion)] = importacion.replace(parametros, parametros + ', ' + quitarSeparador(controller.entityName, '-') + 'Controller');
            }
            if (importacion.indexOf(`.controller';`) !== -1) {
                mod.import = removeFromArr(mod.import, importacion);
            }
        }
        let module = mod.import.join('');
        module = module.concat(restoClase);
        re = escapeRegExp(',,');
        module = module.replace(re, ',');
        escribirFichero(modulePath, module);
    } catch (err) {
        console.error(err);
    } finally {
        let nameController = controller.entityName + ".controller.ts";
        console.log(`
        ---------- ACCION FINALIZADA -----------\n
        Se ha creado el controller en el módulo\n
        - Módulo: ${chalk.blue.bold('api')}\n
        - Controller: ${chalk.blue.bold(nameController)}\n
        ----------------------------------------\n
      `);
        console.log(stdout);
    }
}

const controller = async () => {
    console.log("\n");
    console.log(chalk.bold.green("==================="));
    console.log(chalk.bold.green("Crear un controller"));
    console.log(chalk.bold.green("==================="));

    const controlador = await inquirer.prompt(await preguntaBase());
    await createController(controlador);

};
const generateController = async (name, direccion) => {
    const {stdout} = await exec(`nest g --no-spec --flat controller ${name} ${direccion}`);
    return stdout;
};
module.exports = {controller, createController};