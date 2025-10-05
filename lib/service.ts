const inquirer = require('inquirer');
const chalk = require('chalk');
const pathBase = process.cwd();
var templateService = require("../template/service.template");
const {escribirFichero, escribirIndex, escapeRegExp, quitarSeparador, aInicialMinuscula} = require("../util/util");
const fs = require("fs");
const {preguntaBase} = require("../template/preguntaBase");
const ruta = require("path");

const newService = preguntaBase({
    type: "confirm",
    name: "traza",
    message: "¿Desea activar las trazas en este service (Presione enter para YES)?",
    default: true,
});
const createService = async (service) => {
    let path = ruta.normalize(`${pathBase}/src/core`);
    let folderPath = ruta.normalize(`${path}/service`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    let filePath = ruta.normalize(`${folderPath}/${service.entityName}.service.ts`);
    let nombre = quitarSeparador(service.entityName,'-');
    try {
        fs.writeFileSync(filePath, '');
        var re = escapeRegExp('$name');
        templateService = templateService.replace(re, nombre);
        re = escapeRegExp('$param');
        templateService = templateService.replace(re, aInicialMinuscula(quitarSeparador(service.entityName,'-')));
        re = escapeRegExp('$traza');
        let traza = false;
        if (service.traza) {
            traza = true;
        }
        templateService = templateService.replace(re, traza);
        escribirFichero(filePath, templateService)
        filePath = ruta.normalize(`${folderPath}/index.ts`);
        let exportar = `export {${nombre}Service} from './${service.entityName}.service';\n`;
        escribirIndex(filePath, exportar);

        let servicePath = ruta.normalize(`${path}/core.service.ts`);
        let fichero = fs.readFileSync(servicePath, 'utf8');
        let parametros = fichero.substring(fichero.indexOf(`} from './service'`));
        fichero = fichero.replace(parametros, quitarSeparador(service.entityName, '-') + 'Service,' + parametros.trim());
        parametros = fichero.substring(fichero.indexOf('[') + 1, fichero.indexOf(']'));
        fichero = fichero.replace(parametros, parametros.trim()  + ', ' + quitarSeparador(service.entityName, '-') + 'Service,');
        re = escapeRegExp(',,');
        fichero = fichero.replace(re, ',');
        escribirFichero(servicePath, fichero);
    } catch (err) {
        console.error(err);
    } finally {
        let nameService = service.entityName + ".service.ts";
        console.log(`
        --------- ACCION FINALIZADA ---------\n
        Se ha creado el servicio en el módulo\n
        - Módulo: ${chalk.blue.bold('core')}\n
        - Servicio: ${chalk.blue.bold(nameService)}\n
        -------------------------------------\n
      `);
    }
}

const service = async () => {
    console.log("\n");
    console.log(chalk.bold.green("================"));
    console.log(chalk.bold.green("Crear un service"));
    console.log(chalk.bold.green("================"));

    const service = await inquirer.prompt(await newService);
    await createService(service);
};
module.exports = {service,createService};