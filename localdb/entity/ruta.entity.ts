import {GenericRepository} from "./generic.repository";

export class RutaEntity {
    id: number;
    ruta: string;

    constructor(id?: number, ruta?: string) {
        this.id = id || 0;
        this.ruta = ruta || '';
    }
}

export class RutaRepository extends GenericRepository<RutaEntity> {
    constructor() {
        super('ruta');
    }
}
