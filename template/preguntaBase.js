const {entidades} = require("../util/util");
const preguntaBase = async (...pregunta) => {
    let preguntas = [
        {
            name: "entityName",
            type: "search-list",
            choices: entidades,
            message: "Escribe el nombre de la entidad:",
        }];
    if (pregunta) {
        preguntas = preguntas.concat(pregunta);
    }
    return preguntas;
};
module.exports = {preguntaBase};