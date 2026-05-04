const inquirer = require("inquirer");
const chalk = require("chalk");

const preguntas = [
  {
    type: "list",
    name: "opcion",
    message: "¿Que desea hacer?",
    pageSize: 11,
    choices: [
      {
        value: "controlador",
        name: "Crear un controlador",
      },
      {
        value: "dtos",
        name: "Crear DTOS",
      },
      {
        value: "service",
        name: "Crear un service",
      },
      {
        value: "mapper",
        name: "Crear un mapper",
      },
      {
        value: "repository",
        name: "Crear un repository",
      },
      {
        value: "entity",
        name: "Crear un entity",
      },
      {
        value: "crud",
        name: "Crear un CRUD completo",
      },
      {
        value: "exit",
        name: "Salir del CLI",
      },
    ],
  },
];

const menu = async () => {
  console.log(chalk.bold.green("====================="));
  console.log(chalk.bold.green("Seleccione una opción"));
  console.log(chalk.bold.green("====================="));
  return await inquirer.prompt(preguntas);
};
module.exports = { menu };
