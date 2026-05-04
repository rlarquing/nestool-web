const inquirer = require('inquirer');
const chalk = require('chalk');
const pathBase = process.cwd();
let templateRepository = require("../template/repository.template");
const {
    escribirFichero,
    escribirIndex,
    escapeRegExp,
    quitarSeparador,
    aInicialMinuscula
} = require("../util/util");
const fs = require("fs");
const {preguntaBase} = require("../template/preguntaBase");
const ruta = require("path");
const {parse} = require("../util/parseEntity");

const createRepository = async (repository) => {
    let path = ruta.normalize(`${pathBase}/src/persistence`);
    let folderPath = ruta.normalize(`${path}/repository`);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, 0o777);
    }
    let filePath = ruta.normalize(`${folderPath}/${repository.entityName}.repository.ts`);
    let nombre = quitarSeparador(repository.entityName, '-');
    let relations = [];
    try {
        fs.writeFileSync(filePath, '');
        let re = escapeRegExp('$name');
        templateRepository = templateRepository.replace(re, nombre);
        re = escapeRegExp('$param');
        templateRepository = templateRepository.replace(re, aInicialMinuscula(quitarSeparador(repository.entityName, '-')));
        let rutaEntity = ruta.normalize(`${path}/entity/${repository.entityName}.entity.ts`);
        let entity = parse(rutaEntity);
        let clase = entity.find((item) => item.type === 'class');
        let atributos = clase.attributes.filter((item) => item.kind.includes('Entity'));
        relations = atributos.map((item) => `'${item.name}'`);
        if (relations.length > 0) {
            templateRepository = templateRepository.replace('$relations', relations.toString());
        } else {
            templateRepository = templateRepository.replace(',[$relations]', '');
        }
        escribirFichero(filePath, templateRepository);
        filePath = ruta.normalize(`${folderPath}/index.ts`);
        let exportar = `export {${nombre}Repository} from './${repository.entityName}.repository';\n`;
        escribirIndex(filePath, exportar);


        let servicePath = ruta.normalize(`${path}/persistence.service.ts`);
        let fichero = fs.readFileSync(servicePath, 'utf8');
        let parametros = fichero.substring(fichero.indexOf('{') + 1, fichero.indexOf('}'));
        fichero = fichero.replace(parametros, parametros.trim() + ', ' + quitarSeparador(repository.entityName, '-') + 'Repository,');
        parametros = fichero.substring(fichero.indexOf('[') + 1, fichero.indexOf(']'));
        fichero = fichero.replace(parametros, parametros.trim()  + ', ' + quitarSeparador(repository.entityName, '-') + 'Repository,');
        re = escapeRegExp(',,');
        fichero = fichero.replace(re, ',');
        escribirFichero(servicePath, fichero);
    } catch (err) {
        console.error(err);
    } finally {
        let nameRepositorio = repository.entityName + ".repository.ts";
        console.log(`
        ---------- ACCION FINALIZADA -----------\n
        Se ha creado el repository en el módulo\n
        - Módulo: ${chalk.blue.bold('persistence')}\n
        - Repositorio: ${chalk.blue.bold(nameRepositorio)}\n
        ----------------------------------------\n
      `);
    }
}

const repository = async () => {
    console.log("\n");
    console.log(chalk.bold.green("==================="));
    console.log(chalk.bold.green("Crear un repository"));
    console.log(chalk.bold.green("==================="));

    let repository = await inquirer.prompt(await preguntaBase());
    await createRepository(repository);

};
module.exports = {repository, createRepository};