import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import * as ts from 'typescript';
import { formatearNombre, eliminarSufijo } from '@/utilities/entity-utils';

// F10-C1/C2/M1 — Orquestador honesto y atómico:
//
//  F10-M1: PRE-FLIGHT (entity existe; NINGÚN artefacto pre-existe → 409 temprano
//  sin escribir nada) + SNAPSHOT de los ficheros compartidos modificables +
//  ROLLBACK all-or-nothing (restaura snapshots, borra artefactos creados) si
//  cualquier paso o la validación falla. El `someSuccess → success:true` se
//  elimina: success=false salvo que TODO el proceso (pasos + verificación)
//  haya ido bien; el reporte por paso se devuelve siempre.
//
//  F10-C1: VERIFICACIÓN POST-GENERACIÓN REAL: (a) registros dinámicos
//  (persistence/core/api contienen los símbolos nuevos); (b) `tsc --noEmit`
//  del proyecto destino (node_modules/.bin/tsc) con clasificación de errores:
//  errores en ficheros tocados por esta generación = FALLO (rollback);
//  errores preexistentes en src/ = FALLO con mensaje que lo aclara (la api no
//  compila: no se puede prometer éxito); errores en test/ u otros = ignorados
//  (baseline de la api). Si tsc no está disponible: fallback transpile
//  (sintáctico) con `verificacion.modo` reportado honestamente.
//
//  F10-C2: la cadena 4–9 ensamblada (lotes 1–6) + la verificación (a)+(b)
//  institucionalizan el "la api generada compila" dentro del orquestador.

interface StepResult {
    success: boolean;
    message: string;
    error?: string;
}

interface Verificacion {
    modo: 'tsc' | 'transpile' | 'ninguna';
    registros: { persistence: boolean; core: boolean; api: boolean };
    erroresTocados: string[];
    preexistentesSrc: number;
    preexistentesOtro: number;
    avisos: string[];
}

interface RollbackInfo {
    ejecutado: boolean;
    restaurados: string[];
    eliminados: string[];
    errores: string[];
    motivo?: string;
}

const PASOS = ['dto', 'mapper', 'repository', 'service', 'controller', 'seed'] as const;
type Paso = (typeof PASOS)[number];

export async function POST(req: NextRequest) {
    try {
        const { entityName, basePath, traza = true } = await req.json();

        if (!entityName || !basePath) {
            return NextResponse.json({
                error: 'entityName y basePath son requeridos'
            }, { status: 400 });
        }
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(entityName)) {
            return NextResponse.json({
                error: 'El nombre de la entidad debe empezar con mayúscula'
            }, { status: 400 });
        }

        const nombre = eliminarSufijo(entityName, 'Entity');
        const kebab = formatearNombre(nombre, '-');
        const nombreLower = nombre.charAt(0).toLowerCase() + nombre.slice(1);

        // --- Rutas de artefactos y ficheros compartidos (relativas a basePath) ---
        const artefactos: string[] = [
            `src/shared/dto/create-${kebab}.dto.ts`,
            `src/shared/dto/update-${kebab}.dto.ts`,
            `src/shared/dto/update-multiple-${kebab}.dto.ts`,
            `src/shared/dto/read-${kebab}.dto.ts`,
            `src/core/mapper/${kebab}.mapper.ts`,
            `src/persistence/repository/${kebab}.repository.ts`,
            `src/core/service/${kebab}.service.ts`,
            `src/api/controller/${kebab}.controller.ts`,
            `src/database/seed/crud-${kebab}.seed.ts`,
        ];
        const ficherosCompartidos: string[] = [
            'src/shared/dto/index.ts',
            'src/core/mapper/index.ts',
            'src/core/core.service.ts',
            'src/persistence/repository/index.ts',
            'src/persistence/persistence.service.ts',
            'src/core/service/index.ts',
            'src/api/controller/index.ts',
            'src/api/api.service.ts',
            'src/main.ts',
        ];
        const ficherosTocados: string[] = [
            `src/persistence/entity/${kebab}.entity.ts`,
            ...artefactos,
            ...ficherosCompartidos,
        ];

        // --- PRE-FLIGHT (F10-M1): fallar ANTES de escribir nada ---
        const entityRel = `src/persistence/entity/${kebab}.entity.ts`;
        const entityPath = path.join(basePath, entityRel);
        if (!existsSync(entityPath)) {
            return NextResponse.json({
                error: `La entity no existe (${entityRel}). Créala primero con /api/crear-entidad.`
            }, { status: 400 });
        }
        const yaExisten: string[] = artefactos.filter((rel) => existsSync(path.join(basePath, rel)));
        if (yaExisten.length > 0) {
            return NextResponse.json({
                error: `El CRUD de ${nombre} ya existe (total o parcialmente). No se escribió nada. Ficheros presentes: ${yaExisten.join(', ')}`
            }, { status: 409 });
        }

        // --- SNAPSHOT (F10-M1): contenido actual (null = no existía) ---
        const snapshots = new Map<string, string | null>();
        for (const rel of ficherosCompartidos) {
            const abs = path.join(basePath, rel);
            if (!existsSync(abs)) {
                snapshots.set(rel, null);
                continue;
            }
            try {
                snapshots.set(rel, readFileSync(abs, 'utf-8'));
            } catch {
                return NextResponse.json({
                    error: `El fichero compartido ${rel} no es legible (permisos). No se escribió nada; corrígelo y reintenta.`
                }, { status: 400 });
            }
        }

        const results: { [K in Paso]?: StepResult } = {};
        const origin = new URL(req.url).origin;

        const llamar = async (paso: Paso, ruta: string, body: object): Promise<boolean> => {
            try {
                const response = await fetch(`${origin}${ruta}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await response.json();
                results[paso] = {
                    success: response.ok,
                    message: data.message || data.error || `Error en el paso ${paso}`,
                };
                if (!response.ok) {
                    console.error(`Error en paso ${paso}:`, data.error);
                }
                return response.ok;
            } catch (error) {
                results[paso] = { success: false, message: 'Error de conexión', error: String(error) };
                return false;
            }
        };

        // --- PASOS 1..6 (fail-fast: al primer fallo se rompe y se hace rollback) ---
        let pasoFallido: Paso | null = null;
        if (!(await llamar('dto', '/api/crear-dto', { dtoName: entityName, basePath, modo: 'crud' }))) {
            pasoFallido = 'dto';
        } else if (!(await llamar('mapper', '/api/crear-mapper', { entityName, basePath }))) {
            pasoFallido = 'mapper';
        } else if (!(await llamar('repository', '/api/crear-repository', { entityName, basePath }))) {
            pasoFallido = 'repository';
        } else if (!(await llamar('service', '/api/crear-service', { entityName, basePath, traza }))) {
            pasoFallido = 'service';
        } else if (!(await llamar('controller', '/api/crear-controller', { entityName, basePath }))) {
            pasoFallido = 'controller';
        } else if (!(await llamar('seed', '/api/crear-seed', { entityName, basePath }))) {
            pasoFallido = 'seed';
        }

        const rollback: RollbackInfo = { ejecutado: false, restaurados: [], eliminados: [], errores: [] };

        const ejecutarRollback = (motivo: string): void => {
            rollback.ejecutado = true;
            rollback.motivo = motivo;
            const restaurar = (rel: string): void => {
                const abs = path.join(basePath, rel);
                const contenido = snapshots.get(rel);
                try {
                    if (typeof contenido === 'string') {
                        writeFileSync(abs, contenido);
                        rollback.restaurados.push(rel);
                    } else if (existsSync(abs)) {
                        unlinkSync(abs);
                        rollback.eliminados.push(rel);
                    }
                } catch (e) {
                    rollback.errores.push(`${rel}: ${e instanceof Error ? e.message : String(e)}`);
                }
            };
            for (const rel of snapshots.keys()) restaurar(rel);
            for (const rel of artefactos) restaurar(rel);
        };

        if (pasoFallido) {
            ejecutarRollback(`fallo en el paso ${pasoFallido}`);
            return NextResponse.json({
                success: false,
                error: `CRUD de ${nombre} NO creado: falló el paso ${pasoFallido}. Se hizo rollback completo (la api quedó como antes).`,
                results,
                rollback,
            }, { status: 500 });
        }

        // --- VERIFICACIÓN (F10-C1/C2) ---
        const verificacion: Verificacion = {
            modo: 'ninguna',
            registros: { persistence: false, core: false, api: false },
            erroresTocados: [],
            preexistentesSrc: 0,
            preexistentesOtro: 0,
            avisos: [],
        };
        const nombreEntity = nombre + 'Entity';
        const nombreRepo = nombre + 'Repository';
        const nombreMapper = nombre + 'Mapper';
        const nombreService = nombre + 'Service';
        const nombreController = nombre + 'Controller';

        // (a) Registros dinámicos completos
        const persistenceContent = existsSync(path.join(basePath, 'src/persistence/persistence.service.ts'))
            ? readFileSync(path.join(basePath, 'src/persistence/persistence.service.ts'), 'utf-8') : '';
        const coreContent = existsSync(path.join(basePath, 'src/core/core.service.ts'))
            ? readFileSync(path.join(basePath, 'src/core/core.service.ts'), 'utf-8') : '';
        const apiContent = existsSync(path.join(basePath, 'src/api/api.service.ts'))
            ? readFileSync(path.join(basePath, 'src/api/api.service.ts'), 'utf-8') : '';
        verificacion.registros.persistence = persistenceContent.includes(nombreEntity) && persistenceContent.includes(nombreRepo);
        verificacion.registros.core = coreContent.includes(nombreService) && coreContent.includes(nombreMapper);
        verificacion.registros.api = apiContent.includes(nombreController);
        const registrosOk = verificacion.registros.persistence && verificacion.registros.core && verificacion.registros.api;

        // (b) Compilación real: tsc del proyecto destino; fallback transpile
        const tscBin = path.join(basePath, 'node_modules', '.bin', 'tsc');
        const touchedSet = new Set(ficherosTocados);
        const regexTsc = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

        if (registrosOk && existsSync(tscBin)) {
            const proc = spawnSync(tscBin, ['--noEmit'], { cwd: basePath, encoding: 'utf-8', timeout: 180000 });
            if (proc.error) {
                verificacion.avisos.push(`tsc no pudo ejecutarse (${String(proc.error)}); no se verificó compilación`);
            } else {
                verificacion.modo = 'tsc';
                const salida = `${proc.stdout || ''}${proc.stderr || ''}`;
                for (const linea of salida.split('\n')) {
                    const m = linea.match(regexTsc);
                    if (!m) continue;
                    const fichero = m[1].replace(/\\/g, '/');
                    if (touchedSet.has(fichero)) {
                        verificacion.erroresTocados.push(`${fichero}(${m[2]},${m[3]}): ${m[4]}: ${m[5]}`);
                    } else if (fichero.startsWith('src/')) {
                        verificacion.preexistentesSrc++;
                    } else {
                        verificacion.preexistentesOtro++;
                    }
                }
            }
        } else if (registrosOk) {
            verificacion.avisos.push('tsc no disponible en el proyecto destino (¿falta bun/npm install?); validación solo SINTÁCTICA (transpile)');
            verificacion.modo = 'transpile';
            for (const rel of ficherosTocados) {
                const abs = path.join(basePath, rel);
                if (!existsSync(abs)) continue;
                const resultado = ts.transpileModule(readFileSync(abs, 'utf-8'), {
                    fileName: rel,
                    reportDiagnostics: true,
                    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
                });
                for (const d of resultado.diagnostics || []) {
                    if (d.category === ts.DiagnosticCategory.Error) {
                        const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
                        verificacion.erroresTocados.push(`${rel}: ${typeof d.code === 'number' ? 'TS' + d.code : 'sintaxis'}: ${msg}`);
                    }
                }
            }
        }

        // --- DECISIÓN HONESTA ---
        if (!registrosOk) {
            ejecutarRollback('registros dinámicos incompletos tras la generación');
            return NextResponse.json({
                success: false,
                error: `CRUD de ${nombre} generado pero los registros dinámicos quedaron incompletos (persistence=${verificacion.registros.persistence}, core=${verificacion.registros.core}, api=${verificacion.registros.api}). Rollback ejecutado.`,
                results, verificacion, rollback,
            }, { status: 500 });
        }
        if (verificacion.erroresTocados.length > 0) {
            ejecutarRollback('errores de compilación en ficheros generados');
            return NextResponse.json({
                success: false,
                error: `CRUD de ${nombre} NO creado: los ficheros generados no compilan (${verificacion.erroresTocados.length} errores). Rollback ejecutado; la api quedó como antes.`,
                results,
                verificacion: { ...verificacion, erroresTocados: verificacion.erroresTocados.slice(0, 20) },
                rollback,
            }, { status: 400 });
        }
        if (verificacion.preexistentesSrc > 0) {
            ejecutarRollback(`errores preexistentes en src/ (${verificacion.preexistentesSrc}); la api no compila antes de esta generación`);
            return NextResponse.json({
                success: false,
                error: `CRUD de ${nombre} NO creado: el proyecto destino tiene ${verificacion.preexistentesSrc} error(es) PREEXISTENTES en src/ (no causados por la generación). Arréglalos y reintenta. Rollback ejecutado.`,
                results, verificacion, rollback,
            }, { status: 400 });
        }

        const modoMsg = verificacion.modo === 'tsc'
            ? 'verificado con tsc --noEmit (0 errores en src/)'
            : verificacion.modo === 'transpile'
                ? 'verificación solo sintáctica (tsc no disponible)'
                : 'NO verificado (tsc indisponible)';

        return NextResponse.json({
            success: true,
            message: `CRUD completo para ${nombre} creado exitosamente (${modoMsg}); incluye seed de permisos — reinicie la api para sembrar`,
            results,
            verificacion,
            rollback,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: `Error al crear el CRUD completo: ${message}`
        }, { status: 500 });
    }
}
