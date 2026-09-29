// F10-m1: parámetros compartidos de los generadores.
// Los generadores son funciones directas (sin HTTP) que devuelven NextResponse;
// las rutas de app/api son envoltorios finos y el orquestador
// crear-crud-completo las invoca SIN round-trips HTTP.

export interface CrearDtoParams {
    dtoName: string;
    atributos?: any[];
    basePath: string;
    modo: string;
    esNomenclador?: boolean;
}

export interface EntityParams {
    entityName: string;
    basePath: string;
}

export interface CrearServiceParams extends EntityParams {
    traza?: boolean;
}
