import {aInicialMayuscula} from "./a-inicial-mayuscula.utility";

export const quitarSeperador = (str: string, separador: string): string => {
    if (str.length === 0) {
        return '';
    }
    if (str.indexOf('_') !== -1) {
        separador = '_';
    }
    const resultado: any = str
        .split(separador)
        .map((item) => aInicialMayuscula(item));
    return resultado.join('').substring(0, 1).toLocaleLowerCase()+resultado.join('').substring(1);
};
