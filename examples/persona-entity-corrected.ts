import {Column, Entity} from "typeorm";
import {GenericEntity} from "./generic.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';

@Entity('persona', { schema: SchemaEnum.public })
export class Persona extends GenericEntity {

    @Column(length: 255, nullable: false, unique: false)
    nombre: string;

    @Column(length: 255, nullable: false, unique: false)
    apellidos: string;

    constructor(nombre: string, apellidos: string) {
        super();
        this.nombre = nombre;
        this.apellidos = apellidos;
    }

   public toString(): string {
        return '';
    }
} 