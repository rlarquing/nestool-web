import {GenericRepository} from "./generic.repository";

export class ProyectoEntity {
    id: number;
    nombre: string;

    constructor(id?: number, nombre?: string) {
        this.id = id || 0;
        this.nombre = nombre || '';
    }
}

export class ProyectoRepository extends GenericRepository<ProyectoEntity> {
    constructor() {
        super('proyecto');
    }
}
