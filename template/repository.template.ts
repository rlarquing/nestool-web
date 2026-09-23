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
