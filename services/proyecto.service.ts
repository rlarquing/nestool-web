import {ProyectoEntity, ProyectoRepository} from "../localdb/entity";

export class ProyectoService {
    private proyectoRepository: ProyectoRepository;

    constructor() {
        this.proyectoRepository = new ProyectoRepository();
    }

    async create(proyecto: any): Promise<void> {
        const newP: ProyectoEntity = new ProyectoEntity(1, proyecto.dir);
        await this.proyectoRepository.add(newP);

    }
}