// Template de entidad genérica para generación dinámica
export const genericEntity: string = `\nimport {Column, Entity, $typeorm} from "typeorm";\nimport {GenericEntity} from "./generic.entity";\nimport { SchemaEnum } from '../../database/schema/schema.enum';\n$import\n\n@Entity('$entidad', { schema: SchemaEnum.$schema })\nexport class $nameEntity extends GenericEntity {\n\n    $atributos\n\n    constructor($parametros) {\n        super();\n        $thisAtributos\n    }\n\n   public toString(): string {\n        return '';\n    }\n}\n`;
export const genericNomencladorEntity=`
import {Entity} from "typeorm";
import {GenericNomencladorEntity} from "./generic-nomenclador.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';

@Entity('nom_$entidad', { schema: SchemaEnum.$schema })
export class $nameEntity extends GenericNomencladorEntity {
}
`;
