const chalk = require("chalk");
const figlet = require("figlet");
const inquirer = require("inquirer");
const fs = require("fs");
const pathBase = process.cwd();
const util = require("util");
const ruta = require("path");
const {parseM} = require("../util/parseModule");
const {escribirFichero} = require("../util/util");
const exec = util.promisify(require("child_process").exec);

// Mostrar un banner con un mensaje formado por caracteres.
const msn = (msn) => {
  console.log(
    chalk.bold.cyan(
      figlet.textSync(msn, {
        font: "ANSI Shadow",
        horizontalLayout: "default",
        verticalLayout: "default",
      })
    )
  );
};
module.exports = { msn };
