// Template de entidad genérica para generación dinámica
// Fase 3: orderBy en el @Entity (F1-m1), toString real (F1-M3) e import typeorm
// completo provisto por la ruta (sin comas colgantes).
export const genericEntity: string = `$typeormImport
import { GenericEntity } from './generic.entity';
import { SchemaEnum } from '../../database/schema/schema.enum';
$import

$index@Entity('$entidad', { schema: SchemaEnum.$schema, orderBy: { id: 'ASC' } })
export class $nameEntity extends GenericEntity {

    $atributos

    constructor($parametros) {
        super();
        $thisAtributos
    }

    public toString(): string {
        $toStringBody
    }
}
`;
export const genericNomencladorEntity=`
import {Entity} from "typeorm";
import {GenericNomencladorEntity} from "./generic-nomenclador.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';

@Entity('nom_$entidad', { schema: SchemaEnum.$schema })
export class $nameEntity extends GenericNomencladorEntity {
}
`;
