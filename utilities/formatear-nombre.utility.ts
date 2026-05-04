import {esMayuscula} from "./es-mayuscula.utility";

export const formatearNombre = (str: string, separador: string) => {
    if (str.length === 0) {
        return '';
    }
    if (str.indexOf('_') !== -1) {
        separador = '_';
    }
    let resultado = str[0].toLocaleLowerCase();
    for (let i = 1; i < str.length; i++) {
        if (esMayuscula(str[i])) {
            resultado += separador;
        }
        resultado += str[i].toLocaleLowerCase();
    }
    return resultado;
};
