const inquirer = require('inquirer');
const chalk = require('chalk');
const {preguntaBase} = require("../template/preguntaBase");
const {createCrudDto} = require("./dtos");
const {createMapper} = require("./mapper");
const {createRepository} = require("./repository");
const {createService} = require("./service");
const {createController} = require("./controller");
const createCRUD = async (crud) => {
    try {
        await createCrudDto(crud);
        await createMapper(crud);
        await createRepository(crud);
        await createService(crud);
        await createController(crud);
    } catch (err) {
        console.error(err);
    } finally {
        console.log(`
        ---------- ACCION FINALIZADA -----------\n
        Se ha creado el CRUD\n
        - Entidad: ${chalk.blue.bold(crud.entityName)}\n
        ----------------------------------------\n
      `);
    }
}

const crud = async () => {
    console.log("\n");
    console.log(chalk.bold.green("==================="));
    console.log(chalk.bold.green("Crear un CRUD Completo"));
    console.log(chalk.bold.green("==================="));

    let crud = await inquirer.prompt(await preguntaBase());
    await createCRUD(crud);

};
module.exports = {crud};