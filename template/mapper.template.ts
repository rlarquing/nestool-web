// Templates del mapper — fuente única usada por app/api/crear-mapper (F6-C2).
// Fase 3:
//  - F6-C1: rama relacional fiel a menu-traduccion.mapper.ts (inyección del propio
//    repository, resolución con findXById + NotFoundException con i18n, mapeo por id en el Read).
//  - F6-M1: el mapper simple es síncrono y usa la variable dtoToString (sin métodos async sin await).
//  - Corregidos los typos ("mepper") y los placeholders sin sustituir.

/** Mapper para entidades SIN relaciones unitarias (ManyToOne/OneToOne). Síncrono. */
export const mapperSimpleTemplate = `import { Injectable } from '@nestjs/common';
import { $nameEntity } from '../../persistence/entity';
import { Create$nameDto, Read$nameDto, Update$nameDto } from '../../shared/dto';

@Injectable()
export class $nameMapper {

    dtoToEntity(create$nameDto: Create$nameDto): $nameEntity {
        return new $nameEntity($parametrosDtoToEntity);
    }

    dtoToUpdateEntity(update$nameDto: Update$nameDto, update$nameEntity: $nameEntity): $nameEntity {
$analisisDtoToUpdateEntity
        return update$nameEntity;
    }

    entityToDto($attrNameEntity: $nameEntity): Read$nameDto {
        const dtoToString: string = $attrNameEntity.toString();
        return new Read$nameDto($parametrosEntityToDto);
    }
}
`;

/**
 * Mapper para entidades CON relaciones unitarias (ManyToOne/OneToOne).
 * La ruta provee: $entidadesImport, $resolucionCreate, $resolucionUpdate,
 * $asignacionesUpdate, $parametrosDtoToEntity y $parametrosEntityToDto.
 */
export const mapperRelacionalTemplate = `import { Injectable, NotFoundException } from '@nestjs/common';
import { $entidadesImport } from '../../persistence/entity';
import { Create$nameDto, Read$nameDto, Update$nameDto } from '../../shared/dto';
import { $nameRepository } from '../../persistence/repository';
import { traducir } from '../../shared/util/i18n.util';

@Injectable()
export class $nameMapper {
    constructor(
        private $attrNameRepository: $nameRepository,
    ) {}

    async dtoToEntity(create$nameDto: Create$nameDto): Promise<$nameEntity> {
$resolucionCreate
        return new $nameEntity($parametrosDtoToEntity);
    }

    async dtoToUpdateEntity(update$nameDto: Update$nameDto, update$nameEntity: $nameEntity): Promise<$nameEntity> {
$resolucionUpdate
$asignacionesUpdate
        return update$nameEntity;
    }

    entityToDto($attrNameEntity: $nameEntity): Read$nameDto {
        const dtoToString: string = $attrNameEntity.toString();
        return new Read$nameDto($parametrosEntityToDto);
    }
}
`;
