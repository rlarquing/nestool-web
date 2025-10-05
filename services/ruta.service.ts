import {RutaEntity, RutaRepository} from "@/localdb/entity";

export class RutaService {
    private rutaRepository: RutaRepository;

    constructor() {
        this.rutaRepository = new RutaRepository();
    }

    async create(ruta: any): Promise<void> {
        const newR: RutaEntity = new RutaEntity(1, ruta.dir);
        await this.rutaRepository.add(newR);

    }
}