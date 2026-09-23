// Utilidades para generación de entidades
// Fase 3: generación de relaciones fiel al modelo api-base:
//  - F1-C2: el callback del lado dueño apunta a la colección inversa real inyectada en el destino
//  - F1-C3: JoinTable ManyToMany con joinColumn del lado ACTUAL e inverseJoinColumn del relacionado
//  - F1-C5: en la inversa OneToMany→ManyToOne, la FK del hijo se nombra con la entidad PADRE
//  - F1-M1: opciones FK (onDelete/nullable) en el lado dueño, nunca en la inversa
//  - F1-M2: @JoinColumn y @Column siempre con name snake_case explícito
export function formatearNombre(nombre: string, separador: string): string {
    return nombre.replace(/([a-z])([A-Z])/g, `$1${separador}$2`).toLowerCase();
}

export function eliminarSufijo(nombre: string, sufijo: string): string {
    if (nombre.endsWith(sufijo)) {
        return nombre.slice(0, -sufijo.length);
    }
    return nombre;
}

export function aInicialMinuscula(str: string): string {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
}

/** snake_case de una clase o atributo (ignora el sufijo Entity). */
export function snakeDe(nombre: string): string {
    return formatearNombre(eliminarSufijo(nombre, 'Entity'), '_');
}

/**
 * Nombre de colección inversa al estilo api-base (MenuTraduccionEntity → menuTraducciones,
 * RolEntity → rols... convención plural simple: vocal → 's', consonante → 'es').
 */
export function pluralizarEntidad(claseEntity: string): string {
    const base = aInicialMinuscula(eliminarSufijo(claseEntity, 'Entity'));
    if (/[aeiou]$/.test(base)) return `${base}s`;
    return `${base}es`;
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
    // F1-M2: nombre de columna snake_case explícito, como en la api-base
    opciones.push(`name: '${snakeDe(atributo.nombreAtributo)}'`);
    let tipoTypeScript = atributo.tipoDato;
    if (atributo.tipoDato === 'number' && atributo.integer) {
        tipoTypeScript = 'number';
    } else if (atributo.tipoDato === 'Date' || atributo.tipoDato === 'Timestamp') {
        tipoTypeScript = 'Date';
    }
    const optionsString = opciones.length > 0 ? `{ ${opciones.join(', ')} }` : '';
    // TS estricto (strictPropertyInitialization): requeridas llevan "!", nulables "?"
    const marcador = atributo.nulo === true ? '?' : '!';
    return `@Column(${optionsString})\n    ${atributo.nombreAtributo}${marcador}: ${tipoTypeScript};`;
}

/** Contexto necesario para generar el lado dueño de una relación. */
export interface ContextoRelacion {
    /** Clase de la entity ACTUAL (con sufijo Entity), p.ej. 'TareaEntity'. */
    entidadActual: string;
    /** Nombre de la propiedad inversa en la entidad destino (la calcula la ruta). */
    coleccionInversa: string;
    /** Solo OneToMany: nombre de la propiedad dueña que se inyecta en el hijo. */
    nombreInversa?: string;
}

/**
 * Genera el lado DUEÑO/declarado de la relación dentro de la entity nueva.
 * Las opciones FK (onDelete/nullable) viven aquí (F1-M1), como en
 * menu-traduccion.entity.ts: @ManyToOne(() => MenuEntity, (menu) => menu.traducciones, {...}).
 */
export function generarRelacion(atributo: any, contexto: ContextoRelacion): string {
    const { tipoRelacion, rEntity, nombreAtributo } = atributo;
    const marcador = atributo.nulo === true ? '?' : '!';
    const varDestino = aInicialMinuscula(eliminarSufijo(rEntity, 'Entity'));
    const coleccionInversa = contexto.coleccionInversa;
    switch (tipoRelacion) {
        case 'ManyToOne':
            return `@ManyToOne(() => ${rEntity}, (${varDestino}) => ${varDestino}.${coleccionInversa}, {\n        onDelete: 'CASCADE',\n        nullable: ${atributo.nulo === false ? 'false' : 'true'},\n    })\n    @JoinColumn({ name: '${snakeDe(nombreAtributo)}_id' })\n    ${nombreAtributo}${marcador}: ${rEntity};`;
        case 'OneToOne':
            return `@OneToOne(() => ${rEntity}, (${varDestino}) => ${varDestino}.${coleccionInversa}, { onDelete: 'CASCADE' })\n    @JoinColumn({ name: '${snakeDe(nombreAtributo)}_id' })\n    ${nombreAtributo}${marcador}: ${rEntity};`;
        case 'OneToMany':
            // Lado inverso por definición: la FK vive en el hijo (que recibe nombreInversa).
            return `@OneToMany(() => ${rEntity}, (${varDestino}) => ${varDestino}.${contexto.nombreInversa})\n    ${nombreAtributo}!: ${rEntity}[];`;
        case 'ManyToMany': {
            const snakeActual = snakeDe(contexto.entidadActual);
            const snakeDestino = snakeDe(rEntity);
            return `@ManyToMany(() => ${rEntity}, (${varDestino}) => ${varDestino}.${coleccionInversa}, { eager: false })\n    @JoinTable({\n        name: '${snakeActual}_${snakeDestino}',\n        joinColumn: { name: '${snakeActual}_id', referencedColumnName: 'id' },\n        inverseJoinColumn: { name: '${snakeDestino}_id', referencedColumnName: 'id' },\n    })\n    ${nombreAtributo}!: ${rEntity}[];`;
        }
        default:
            return `@Column()\n    ${nombreAtributo}!: ${rEntity};`;
    }
}

/** Parámetros de la entrada para generarRelacionInversa. */
export interface ContextoRelacionInversa {
    /** Tipo de la relación DIRECTA declarada en la entity nueva. */
    tipoRelacion: string;
    /** Nombre del atributo directo (en la entity nueva). */
    nombreAtributo: string;
    /** Clase de la entity NUEVA (dueña del atributo directo). */
    entidadOrigen: string;
    /** Clase de la entity DESTINO donde se inyecta la inversa. */
    entidadDestino: string;
    /** Colección inversa (nombre que recibe la colección de la nueva entity en el destino). */
    coleccionInversa: string;
    /** Solo OneToMany: nombre de la propiedad dueña inyectada en el hijo (FK). */
    nombreInversa?: string;
    /** ¿El atributo directo es requerido (nulo !== true)? */
    requerido: boolean;
}

/**
 * Genera el bloque de relación INVERSA para inyectar en la entity destino,
 * precedido de un ancla idempotente (F1-C4): '// [nestool] inversa de X.y'.
 *  - ManyToOne directa  → OneToMany en destino (sin opciones FK)
 *  - OneToMany directa  → ManyToOne en destino (lado DUEÑO de la FK, F1-C5: nombre = entidad padre)
 *  - OneToOne directa   → OneToOne en destino sin @JoinColumn (la FK la tiene el dueño)
 *  - ManyToMany directa → ManyToMany en destino sin @JoinTable (lado mapeado)
 */
export function generarRelacionInversa(ctx: ContextoRelacionInversa): string {
    const varOrigen = aInicialMinuscula(eliminarSufijo(ctx.entidadOrigen, 'Entity'));
    const ancla = `// [nestool] inversa de ${ctx.entidadOrigen}.${ctx.nombreAtributo}`;
    switch (ctx.tipoRelacion) {
        case 'ManyToOne':
            return `${ancla}\n    @OneToMany(() => ${ctx.entidadOrigen}, (${varOrigen}) => ${varOrigen}.${ctx.nombreAtributo})\n    ${ctx.coleccionInversa}!: ${ctx.entidadOrigen}[];`;
        case 'OneToMany':
            return `${ancla}\n    @ManyToOne(() => ${ctx.entidadOrigen}, (${varOrigen}) => ${varOrigen}.${ctx.nombreAtributo}, {\n        onDelete: 'CASCADE',\n        nullable: false,\n    })\n    @JoinColumn({ name: '${snakeDe(ctx.nombreInversa ?? varOrigen)}_id' })\n    ${ctx.nombreInversa ?? varOrigen}!: ${ctx.entidadOrigen};`;
        case 'OneToOne':
            return `${ancla}\n    @OneToOne(() => ${ctx.entidadOrigen}, (${varOrigen}) => ${varOrigen}.${ctx.nombreAtributo})\n    ${varOrigen}${ctx.requerido ? '!' : '?'}: ${ctx.entidadOrigen};`;
        case 'ManyToMany':
            return `${ancla}\n    @ManyToMany(() => ${ctx.entidadOrigen}, (${varOrigen}) => ${varOrigen}.${ctx.nombreAtributo})\n    ${ctx.coleccionInversa}!: ${ctx.entidadOrigen}[];`;
        default:
            return '';
    }
}

/**
 * Orden de parámetros de constructor al estilo api-base: los requeridos
 * primero (en orden de declaración) y después los opcionales. TypeScript
 * prohíbe un parámetro requerido tras uno opcional (TS1016) y la entity y el
 * mapper deben compartir EXACTAMENTE el mismo orden posicional.
 */
export function ordenRequeridoPrimero<T>(items: T[], esRequerido: (x: T) => boolean): T[] {
    return [...items.filter((x) => esRequerido(x)), ...items.filter((x) => !esRequerido(x))];
}

/**
 * Cuerpo del toString() al estilo api-base: el primer atributo string del
 * formulario (F1-M3). Si es nulable se protege con ?? ''; sin strings,
 * el id.
 */
export function generarToStringBody(atributos: any[]): string {
    const primeraString = atributos.find((a) => a.tipoDato === 'string');
    if (primeraString) {
        return primeraString.nulo === true
            ? `return this.${primeraString.nombreAtributo} ?? '';`
            : `return this.${primeraString.nombreAtributo};`;
    }
    return 'return String(this.id);';
}
