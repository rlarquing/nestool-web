const genericEntity=`
import {Column, Entity, $typeorm} from "typeorm";
import {GenericEntity} from "./generic.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';
$import

@Entity('$entidad', { schema: SchemaEnum.$schema })
export class $nameEntity extends GenericEntity {

    $atributos

    constructor($parametros) {
        super();
        $thisAtributos
    }

   public toString(): string {
        return '';
    }
}
`;
const genericNomencladorEntity=`
import {Entity} from "typeorm";
import {GenericNomencladorEntity} from "./generic-nomenclador.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';

@Entity('nom_$entidad', { schema: SchemaEnum.$schema })
export class $nameEntity extends GenericNomencladorEntity {
}
`;
module.exports={genericEntity,genericNomencladorEntity}