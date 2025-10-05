// Utilidades para generación de entidades
export function formatearNombre(nombre: string, separador: string): string {
    return nombre.replace(/([a-z])([A-Z])/g, `$1${separador}$2`).toLowerCase();
}

export function eliminarSufijo(nombre: string, sufijo: string): string {
    if (nombre.endsWith(sufijo)) {
        return nombre.slice(0, -sufijo.length);
    }
    return nombre;
}

export function generarColumna(atributo: any, databaseType: string = 'postgresql'): string {
    let opciones: string[] = [];
    if (atributo.tipoDato === 'string') {
        if (databaseType === 'postgresql' || databaseType === 'mysql') {
            opciones.push(`type: 'varchar'`);
        } else if (databaseType === 'mssql' || databaseType === 'sqlserver') {
            opciones.push(`type: 'nvarchar'`);
        }
        if (atributo.length) {
            opciones.push(`length: ${atributo.length}`);
        }
    } else if (atributo.tipoDato === 'number') {
        if (atributo.integer) {
            if (databaseType === 'postgresql') {
                opciones.push('type: "integer"');
            } else if (databaseType === 'mysql') {
                opciones.push('type: "int"');
            } else {
                opciones.push('type: "int"');
            }
        } else {
            opciones.push('type: "decimal"');
        }
    } else if (atributo.tipoDato === 'Date' || atributo.tipoDato === 'Timestamp') {
        if (databaseType === 'postgresql') {
            opciones.push('type: "timestamp"');
        } else if (databaseType === 'mysql') {
            opciones.push('type: "datetime"');
        } else {
            opciones.push('type: "timestamp"');
        }
    } else if (atributo.tipoDato === 'boolean') {
        if (databaseType === 'postgresql') {
            opciones.push('type: "boolean"');
        } else if (databaseType === 'mysql') {
            opciones.push('type: "tinyint"');
        } else {
            opciones.push('type: "boolean"');
        }
    } else if (atributo.tipoDato === 'Geometry') {
        opciones.push('type: "geometry"');
    }
    if (atributo.nulo !== undefined) {
        opciones.push(`nullable: ${atributo.nulo}`);
    }
    if (atributo.unico !== undefined) {
        opciones.push(`unique: ${atributo.unico}`);
    }
    let tipoTypeScript = atributo.tipoDato;
    if (atributo.tipoDato === 'number' && atributo.integer) {
        tipoTypeScript = 'number';
    } else if (atributo.tipoDato === 'Date' || atributo.tipoDato === 'Timestamp') {
        tipoTypeScript = 'Date';
    }
    const optionsString = opciones.length > 0 ? `{ ${opciones.join(', ')} }` : '';
    return `@Column(${optionsString})\n    ${atributo.nombreAtributo}: ${tipoTypeScript};`;
}

export function generarRelacion(atributo: any): string {
    const { tipoRelacion, rEntity, nombreAtributo } = atributo;
    const entityNameLower = rEntity.toLowerCase();
    switch (tipoRelacion) {
        case 'OneToOne':
            return `@OneToOne(() => ${rEntity})\n    @JoinColumn()\n    ${nombreAtributo}: ${rEntity};`;
        case 'OneToMany':
            return `@OneToMany(() => ${rEntity}, ${entityNameLower} => ${entityNameLower}.${nombreAtributo})\n    ${nombreAtributo}: ${rEntity}[];`;
        case 'ManyToOne':
            return `@ManyToOne(() => ${rEntity}, ${entityNameLower} => ${entityNameLower}.${nombreAtributo})\n    @JoinColumn()\n    ${nombreAtributo}: ${rEntity};`;
        case 'ManyToMany':
            return `@ManyToMany(() => ${rEntity})\n    @JoinTable({\n        name: '${formatearNombre(eliminarSufijo(atributo.rEntity, 'Entity'), '_')}_${formatearNombre(eliminarSufijo(atributo.nombreAtributo, 'Entity'), '_')}',\n        joinColumn: {\n            name: '${formatearNombre(eliminarSufijo(atributo.rEntity, 'Entity'), '_')}_id',\n            referencedColumnName: 'id'\n        },\n        inverseJoinColumn: {\n            name: '${formatearNombre(eliminarSufijo(atributo.nombreAtributo, 'Entity'), '_')}_id',\n            referencedColumnName: 'id'\n        }\n    })\n    ${nombreAtributo}: ${rEntity}[];`;
        default:
            return `@Column()\n    ${nombreAtributo}: ${rEntity};`;
    }
} 