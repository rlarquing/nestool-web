import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import {
    formatearNombre, eliminarSufijo, generarColumna, generarRelacion,
    generarToStringBody, aInicialMinuscula, pluralizarEntidad, snakeDe, ordenRequeridoPrimero,
} from '@/utilities/entity-utils';
import { inyectarRelacionInversa, registrarEntidadEnIndex, registrarEntidadEnPersistence } from '@/utilities/relacion-inversa';
import { genericEntity } from '@/template/entity.template';

export async function POST(req: NextRequest) {
    try {
        const { entityName, esquema, atributos, basePath, databaseType } = await req.json();

        // Validaciones básicas
        if (!entityName || !basePath) {
            return NextResponse.json({
                error: 'entityName y basePath son requeridos'
            }, { status: 400 });
        }

        if (!atributos || !Array.isArray(atributos) || atributos.length === 0) {
            return NextResponse.json({
                error: 'Se requiere al menos un atributo'
            }, { status: 400 });
        }

        // Validar que el nombre de la entidad sea válido
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
            return NextResponse.json({
                error: 'El nombre de la entidad debe empezar con mayúscula y contener solo letras y números'
            }, { status: 400 });
        }

        // Validar atributos
        for (const atributo of atributos) {
            if (!atributo.nombreAtributo || !atributo.tipoDato) {
                return NextResponse.json({
                    error: 'Todos los atributos deben tener nombre y tipo de dato'
                }, { status: 400 });
            }

            if (atributo.tipoDato === 'relation' && (!atributo.rEntity || !atributo.tipoRelacion)) {
                return NextResponse.json({
                    error: 'Los atributos de relación deben tener entidad relacionada y tipo de relación'
                }, { status: 400 });
            }
        }

        // La clase exportada SIEMPRE termina en Entity
        const className = entityName.endsWith('Entity') ? entityName : entityName + 'Entity';
        const nombreBase = eliminarSufijo(className, 'Entity');
        const kebab = formatearNombre(nombreBase, '-');
        const nombreTabla = formatearNombre(nombreBase, '_');

        const entityDir = path.join(basePath, 'src/persistence/entity');
        const filePath = path.join(entityDir, `${kebab}.entity.ts`);
        if (existsSync(filePath)) {
            // F1-C4: jamás reescribir una entity existente con el template (destruiría código propio)
            return NextResponse.json({
                error: `La entity ${className} ya existe (${filePath})`
            }, { status: 409 });
        }

        // Procesar atributos y generar código
        let importaciones: string[] = [];
        const atributosCode: string[] = [];
        let typeormExtras: string[] = [];
        const constructorAttrs: { param: string; asignacion: string; requerido: boolean }[] = [];
        const avisos: string[] = [];

        const esquemaEnum = (esquema || 'public').toString().toUpperCase();

        for (const atributo of atributos) {
            if (atributo.tipoDato === 'relation') {
                // Imports typeorm del lado directo
                if (atributo.tipoRelacion === 'OneToOne' || atributo.tipoRelacion === 'ManyToOne') {
                    typeormExtras.push('JoinColumn');
                }
                if (atributo.tipoRelacion === 'ManyToMany') {
                    typeormExtras.push('JoinTable');
                }
                typeormExtras.push(atributo.tipoRelacion);

                // Import de la entidad relacionada
                const kebabRelacionada = formatearNombre(eliminarSufijo(atributo.rEntity, 'Entity'), '-');
                importaciones.push(`import { ${atributo.rEntity} } from './${kebabRelacionada}.entity';`);

                // Nombres compartidos entre lado directo e inversa (F1-C2: el callback del
                // lado dueño apunta SIEMPRE a la propiedad que realmente se inyecta en el destino).
                const coleccionInversa = atributo.tipoRelacion === 'OneToOne'
                    ? aInicialMinuscula(nombreBase)
                    : pluralizarEntidad(className);
                const nombreInversa = aInicialMinuscula(nombreBase);

                atributosCode.push(generarRelacion(atributo, {
                    entidadActual: className,
                    coleccionInversa,
                    nombreInversa,
                }));

                // F1-M5: las relaciones unitarias dueñas de FK van en el constructor
                // (modelo menu-traduccion.entity.ts); las colecciones quedan fuera.
                if (atributo.tipoRelacion === 'ManyToOne' || atributo.tipoRelacion === 'OneToOne') {
                    constructorAttrs.push({
                        param: `${atributo.nombreAtributo}${atributo.nulo === true ? '?' : ''}: ${atributo.rEntity}`,
                        asignacion: `this.${atributo.nombreAtributo} = ${atributo.nombreAtributo};`,
                        requerido: atributo.nulo !== true,
                    });
                }

                // Inyección de la relación inversa en la entidad destino
                const resultado = inyectarRelacionInversa(basePath, {
                    tipoRelacion: atributo.tipoRelacion,
                    nombreAtributo: atributo.nombreAtributo,
                    entidadOrigen: className,
                    entidadDestino: atributo.rEntity,
                    coleccionInversa,
                    nombreInversa,
                    requerido: atributo.nulo !== true,
                }, { esquema: esquemaEnum });
                avisos.push(...resultado.avisos);
            } else {
                // Generar columna normal
                atributosCode.push(generarColumna(atributo, databaseType));
                // El constructor replica la opcionalidad de la propiedad: el mapper
                // pasa createXDto.<attr> (string | undefined si es nulable)
                constructorAttrs.push({
                    param: `${atributo.nombreAtributo}${atributo.nulo === true ? '?' : ''}: ${atributo.tipoDato}`,
                    asignacion: `this.${atributo.nombreAtributo} = ${atributo.nombreAtributo};`,
                    requerido: atributo.nulo !== true,
                });
            }
        }

        // TS1016: un parámetro requerido no puede ir detrás de uno opcional.
        // El mapper (crear-mapper) usa el MISMO orden compartido.
        const constructorOrdenado = ordenRequeridoPrimero(constructorAttrs, (a) => a.requerido);
        const parametrosConstructor = constructorOrdenado.map((a) => a.param);
        const thisAtributos = constructorOrdenado.map((a) => a.asignacion);

        // Deduplicar imports typeorm
        typeormExtras = typeormExtras.filter((item, index) => typeormExtras.indexOf(item) === index);

        // F1-m1: índice único compuesto de clase si hay 2+ atributos únicos (estilo UQ_ de la api)
        let indexDecorator = '';
        const unicos = atributos.filter((a) => a.unico === true);
        if (unicos.length >= 2) {
            if (!typeormExtras.includes('Index')) typeormExtras.push('Index');
            const nombreIndice = `UQ_${nombreTabla}_${unicos.map((u) => snakeDe(u.nombreAtributo)).join('_')}`;
            const columnasIndice = unicos.map((u) => `'${u.nombreAtributo}'`).join(', ');
            indexDecorator = `@Index('${nombreIndice}', [${columnasIndice}], { unique: true, where: '"activo" = true' })\n`;
        }

        const importList = ['Column', 'Entity', ...typeormExtras].join(', ');

        // Preparar el template
        let template = genericEntity;
        template = template.replace('$typeormImport', `import { ${importList} } from 'typeorm';`);
        template = template.replace('$import', importaciones.length > 0 ? importaciones.join('\n') : '');
        template = template.replace('$index', indexDecorator);
        template = template.replace('$entidad', nombreTabla);
        template = template.replace('$schema', esquemaEnum);
        template = template.replace('$nameEntity', className);
        template = template.replace('$atributos', atributosCode.join('\n\n    '));
        template = template.replace('$parametros', parametrosConstructor.join(', '));
        template = template.replace('$thisAtributos', thisAtributos.join('\n        '));
        template = template.replace('$toStringBody', generarToStringBody(atributos));

        // Crear directorio si no existe
        if (!existsSync(entityDir)) {
            mkdirSync(entityDir, { recursive: true });
        }

        // Escribir archivo de entidad
        writeFileSync(filePath, template);

        // Registrar en index.ts y en el registro dinámico de persistence.service.ts
        registrarEntidadEnIndex(entityDir, className, kebab);
        registrarEntidadEnPersistence(path.join(basePath, 'src/persistence/persistence.service.ts'), className);

        return NextResponse.json({
            success: true,
            message: `Entidad ${className} creada exitosamente`,
            filePath: filePath,
            avisos: avisos,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: `Error al crear la entidad: ${message}`
        }, { status: 500 });
    }
}
