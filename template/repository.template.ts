// Templates del repository — fuente única usada por app/api/crear-repository.
// Fase 3 (F7-C3): el repositorio relacional inyecta además los repositories de
// las entidades relacionadas (unitarias) y expone helpers findXById con filtro
// activo: true, como menu-traduccion.repository.ts del modelo api-base.

/** Repository para entidades SIN relaciones unitarias. */
export const repositorySimpleTemplate = `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { $nameEntity } from '../entity';
import { IRepository } from '../../shared/interface';
import { GenericRepository } from './generic.repository';

@Injectable()
export class $nameRepository extends GenericRepository<$nameEntity> implements IRepository<$nameEntity> {
    constructor(
        @InjectRepository($nameEntity)
        private $paramRepository: Repository<$nameEntity>,
    ) {
        super($paramRepository$superArgs);
    }

}`;

/**
 * Repository CONCRETO de un nomenclador (F3-C1/C2 — modelo refinado contra la api real).
 * El mapa `repositories` de GenericNomencladorRepository es POR INSTANCIA (protected) y
 * la ÚNICA instancia consultada en runtime es la que GenericNomencladorService inyecta
 * por token de clase. Por eso el concreto NO extiende la base (crearía su propia
 * instancia con el mapa vacío y el CRUD genérico seguiría con 404): implementa
 * OnModuleInit y registra SU Repository<X> en la instancia COMPARTIDA del genérico
 * (DI por token de clase ⇒ mismo singleton que usa el service). El acceso bracket a
 * `['registerRepository']` es deliberado: el método es protected en la base.
 * CONTRATO: $registro == valor de NomencladorTypeEnum == :name del controller
 * (main.ts itera el enum y crea el menú con esos valores).
 */
export const repositoryNomencladorTemplate = `import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { $nameEntity } from '../entity';
import { GenericNomencladorRepository } from './generic-nomenclador.repository';

@Injectable()
export class $nameRepository implements OnModuleInit {
    constructor(
        @InjectRepository($nameEntity)
        private $paramRepository: Repository<$nameEntity>,
        private genericNomencladorRepository: GenericNomencladorRepository,
    ) {}

    onModuleInit(): void {
        this.genericNomencladorRepository['registerRepository']('$registro', this.$paramRepository);
    }
}
`;

/**
 * Repository para entidades CON relaciones unitarias (ManyToOne/OneToOne).
 * La ruta provee: $entidadesImport, $inyeccionesAuxiliares, $relations y $helpers.
 */
export const repositoryRelacionalTemplate = `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { $entidadesImport } from '../entity';
import { IRepository } from '../../shared/interface';
import { GenericRepository } from './generic.repository';

@Injectable()
export class $nameRepository extends GenericRepository<$nameEntity> implements IRepository<$nameEntity> {
    constructor(
        @InjectRepository($nameEntity)
        private $paramRepository: Repository<$nameEntity>,
$inyeccionesAuxiliares
    ) {
        super($paramRepository, [$relations]);
    }

$helpers}`;
