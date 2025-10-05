import {Column, Entity, OneToOne, OneToMany, ManyToMany, JoinColumn, JoinTable} from "typeorm";
import {GenericEntity} from "./generic.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';
import { PerfilEntity } from './perfil.entity';
import { PostEntity } from './post.entity';
import { RolEntity } from './rol.entity';

@Entity('usuario', { schema: SchemaEnum.public })
export class Usuario extends GenericEntity {

    @Column(length: 100, nullable: false)
    nombre: string;

    @Column(length: 255, nullable: false, unique: true)
    email: string;

    @Column(type: "int", nullable: true)
    edad: number;

    @Column(type: "timestamp", nullable: true)
    fechaNacimiento: Date;

    @Column(type: "boolean", nullable: false)
    activo: boolean;

    @OneToOne(() => PerfilEntity)
    @JoinColumn()
    perfil: PerfilEntity;

    @OneToMany(() => PostEntity, post => post.usuario)
    posts: PostEntity[];

    @ManyToMany(() => RolEntity)
    @JoinTable({
        name: 'rol_entity_usuario',
        joinColumn: {
            name: 'rol_entity_id',
            referencedColumnName: 'id'
        },
        inverseJoinColumn: {
            name: 'usuario_id',
            referencedColumnName: 'id'
        }
    })
    roles: RolEntity[];

    constructor(nombre: string, email: string, edad: number, fechaNacimiento: Date, activo: boolean, perfil: PerfilEntity, posts: PostEntity[], roles: RolEntity[]) {
        super();
        this.nombre = nombre;
        this.email = email;
        this.edad = edad;
        this.fechaNacimiento = fechaNacimiento;
        this.activo = activo;
        this.perfil = perfil;
        this.posts = posts;
        this.roles = roles;
    }

   public toString(): string {
        return '';
    }
} 