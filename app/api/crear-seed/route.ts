import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from '@/utilities/entity-utils';

// F9-M2 / F10-M2: sin seed de Funcion/endPoint el PermissionGuard responde 403
// para TODOS los usuarios (exige que controller.servicio exista entre los
// endPoints de las funciones de los roles en BD).
//
// Modelo real de la api (verificado en api-base):
//  - parseController (lib/, llamado desde main.ts en dev) sincroniza SOLO los
//    EndPoint de todos los controllers; NO crea Funcion ni la asigna.
//  - crearMenuAdministracion está fija a 5 controllers (user, rol, logHistory,
//    funcion, menu) y crearMenuNomenclador solo cubre el enum.
//  → Para un CRUD genérico generado falta Menu + Funcion + alta en el rol
//    Administrador. Este generador produce un seed idempotente que espeja el
//    patrón de MenuService.crearMenuNomenclador y se engancha a main.ts justo
//    DESPUÉS de parseController (los endPoints ya existen) y ANTES de
//    asignarFuncionesAdmin (el admin hereda la función nueva).

export async function POST(req: NextRequest) {
    try {
        const { entityName, basePath } = await req.json();

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

        const nombreSinEntity = eliminarSufijo(entityName, 'Entity');
        const nombre = nombreSinEntity;
        const nombreLower = aInicialMinuscula(nombre);
        // Nombre del controller tal como lo registra parseController:
        // eliminarSufijo(className,'Controller') + aInicialMinuscula.
        const controllerNombre = nombreLower;
        // Etiqueta del menú (plural ingenuo, mismo criterio que el tag del controller)
        const label = nombre + 's';
        const seedFunctionName = `sembrarCrud${nombre}`;
        const seedFileName = `crud-${formatearNombre(nombre, '-')}.seed.ts`;
        const seedBaseName = seedFileName.replace(/\.ts$/, '');
        const seedDir = path.join(basePath, 'src', 'database', 'seed');
        const seedPath = path.join(seedDir, seedFileName);
        const mainPath = path.join(basePath, 'src', 'main.ts');

        // --- PRE-CHECKS antes de escribir nada (atomicidad del paso) ---
        if (existsSync(seedPath)) {
            return NextResponse.json({
                error: `El seed ${seedFileName} ya existe`
            }, { status: 409 });
        }
        if (!existsSync(mainPath)) {
            return NextResponse.json({
                error: 'No se encontró src/main.ts en basePath'
            }, { status: 400 });
        }
        let mainContent = readFileSync(mainPath, 'utf-8');
        const mainYaParcheado = mainContent.includes(seedFunctionName);

        // --- 1. Generar el fichero seed (idempotente, patrón crearMenuNomenclador) ---
        const seedContent = `import { INestApplicationContext } from '@nestjs/common';
import { FuncionMapper, MenuMapper } from '../../core/mapper';
import {
  EndPointRepository,
  FuncionRepository,
  MenuRepository,
  RolRepository,
} from '../../persistence/repository';
import { CreateFuncionDto, CreateMenuDto } from '../../shared/dto';
import { RolType, TipoMenuTypeEnum } from '../../shared/enum';
import {
  EndPointEntity,
  FuncionEntity,
  MenuEntity,
  RolEntity,
} from '../../persistence/entity';

/**
 * Seed idempotente generado por nestool-web para el CRUD "${nombre}".
 *
 * Espeja el patrón de MenuService.crearMenuNomenclador: menú + función
 * "Gestión de ${label}" + sus endPoints + alta en el rol Administrador,
 * para que PermissionGuard autorice el acceso al controller "${controllerNombre}".
 *
 * Requisito de orden: se invoca DESPUÉS de parseController (los endPoints
 * del controller ya existen en BD) y ANTES de asignarFuncionesAdmin.
 * Se reintenta en cada arranque (dev): si el menú/función ya existen se
 * actualizan sus endPoints en vez de duplicarlos.
 */
export async function ${seedFunctionName}(
  app: INestApplicationContext,
): Promise<void> {
  const menuRepository = app.get(MenuRepository);
  const endPointRepository = app.get(EndPointRepository);
  const funcionRepository = app.get(FuncionRepository);
  const rolRepository = app.get(RolRepository);
  const menuMapper = app.get(MenuMapper);
  const funcionMapper = app.get(FuncionMapper);

  const label = '${label}';
  const controller = '${controllerNombre}';

  // 1. Menú del CRUD (idempotente: reutiliza el existente por label)
  const createMenuDto: CreateMenuDto = {
    label: label,
    icon: 'list',
    to: '/admin/${formatearNombre(nombre, '-')}s',
    tipo: TipoMenuTypeEnum.ADMINISTRACION,
  };
  const menuEntity: MenuEntity = await menuMapper.dtoToEntity(createMenuDto);
  const existeMenu: MenuEntity[] = await menuRepository.findBy(
    ['label'],
    [label],
  );
  let menuGuardado: MenuEntity;
  if (existeMenu.length > 0) {
    menuGuardado = existeMenu[0];
  } else {
    menuGuardado = await menuRepository.create(menuEntity);
  }

  // 2. EndPoints del controller (parseController los siembra antes)
  const endPoints: EndPointEntity[] =
    await endPointRepository.findByController(controller);

  // 3. Función "Gestión de ${label}" (crea o actualiza endPoints)
  const createFuncionDto: CreateFuncionDto = {
    nombre: \`Gestión de \${label}\`,
    descripcion: \`Gestión de \${label}\`,
    endPoints: endPoints.map((item: EndPointEntity) => item.id),
    menu: menuGuardado.id,
  };
  const funcionExistente: FuncionEntity | null =
    await funcionRepository.findByMenu(menuGuardado);
  let funcionGuardada: FuncionEntity;
  if (funcionExistente) {
    const funcionActualizada: FuncionEntity =
      await funcionMapper.dtoToEntity(createFuncionDto);
    funcionActualizada.id = funcionExistente.id;
    funcionActualizada.activo = funcionExistente.activo;
    funcionActualizada.endPoints = endPoints;
    funcionActualizada.menu = funcionExistente.menu;
    await funcionRepository.update(funcionActualizada);
    funcionGuardada = funcionActualizada;
  } else {
    funcionGuardada = await funcionRepository.create(
      await funcionMapper.dtoToEntity(createFuncionDto),
    );
  }

  // 4. Alta en el rol Administrador (comparación por id de función)
  const rol = (await rolRepository.findByNombre(
    RolType.ADMINISTRADOR,
  )) as RolEntity;
  const yaTieneFuncion: boolean = rol.funcions.some(
    (item: FuncionEntity) => item.id === funcionGuardada.id,
  );
  if (!yaTieneFuncion) {
    rol.funcions.push(funcionGuardada);
    await rolRepository.update(rol);
  }
}
`;

        mkdirSync(seedDir, { recursive: true });
        writeFileSync(seedPath, seedContent);

        // --- 2. Enganchar el seed en main.ts (import + llamada tras parseController) ---
        const avisos: string[] = [];
        let importRegistrado = false;
        let llamadaRegistrada = false;

        if (mainYaParcheado) {
            // main.ts ya referencia este seed (p.ej. fichero borrado a mano):
            // solo se regenera el fichero; no se duplica el parche.
            avisos.push('main.ts ya registraba este seed; solo se regeneró el fichero');
        } else {
            // 2a. Import: tras el import de NomencladorTypeEnum (última línea de
            //     imports del main.ts de la api); fallback robusto: al inicio.
            const enumImportRegex = /import\s*\{\s*NomencladorTypeEnum\s*\}\s*from\s*'\.\/shared\/enum';/;
            const importLine = `import { ${seedFunctionName} } from './database/seed/${seedBaseName}';`;
            if (enumImportRegex.test(mainContent)) {
                mainContent = mainContent.replace(enumImportRegex, (m) => `${m}\n${importLine}`);
            } else {
                mainContent = `${importLine}\n` + mainContent;
                avisos.push('ancla del import no encontrada; import insertado al inicio de main.ts');
            }
            importRegistrado = true;

            // 2b. Llamada: inmediatamente después de parseController (los
            //     endPoints existen) y antes de asignarFuncionesAdmin.
            const callAnchor = 'await parseController(endPointService);';
            if (!mainContent.includes(callAnchor)) {
                // Rollback del import para no dejar main.ts roto
                mainContent = mainContent.replace(`\n${importLine}`, '').replace(`${importLine}\n`, '').replace(importLine, '');
                writeFileSync(mainPath, mainContent);
                return NextResponse.json({
                    error: 'main.ts no contiene el ancla "await parseController(endPointService);"; revise la versión de la api. Seed fichero creado pero NO enganchado.'
                }, { status: 400 });
            }
            mainContent = mainContent.replace(
                callAnchor,
                `${callAnchor}\n    await ${seedFunctionName}(app);`,
            );
            llamadaRegistrada = true;
        }

        writeFileSync(mainPath, mainContent);

        return NextResponse.json({
            success: true,
            message: `Seed de Funcion/endPoints para ${nombre} creado exitosamente (PermissionGuard autorizará ${controllerNombre} tras reiniciar la api)`,
            registro: {
                seedFile: `src/database/seed/${seedFileName}`,
                funcion: `Gestión de ${label}`,
                controller: controllerNombre,
                rol: 'ADMINISTRADOR',
                mainImport: importRegistrado,
                mainLlamada: llamadaRegistrada,
                avisos,
            },
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: `Error al crear el seed: ${message}`
        }, { status: 500 });
    }
}
