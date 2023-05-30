
export const aInicialMayuscula = (str: string): string => {
    let result: string = str;
    if (result.length > 0) {
        result = result.substring(0, 1).toLocaleUpperCase();
    }
    if (str.length > 1) {
        result += str.substring(1);
    }
    return result;
};
