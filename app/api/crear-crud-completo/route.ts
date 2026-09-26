import { NextRequest, NextResponse } from 'next/server';

interface CrudResult {
  dto?: { success: boolean; message: string; error?: string };
  mapper?: { success: boolean; message: string; error?: string };
  repository?: { success: boolean; message: string; error?: string };
  service?: { success: boolean; message: string; error?: string };
  controller?: { success: boolean; message: string; error?: string };
  seed?: { success: boolean; message: string; error?: string };
}

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

    const results: CrudResult = {};
    // Los fetch server-to-server necesitan URL absoluta (fetch relativo falla en Node)
    const origin = new URL(req.url).origin;

    // 1. Crear DTOs para el CRUD
    try {
      const dtoResponse = await fetch(`${origin}/api/crear-dto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // crear-dto espera "dtoName" y "modo: crud" (no entityName como las demas rutas)
        body: JSON.stringify({ dtoName: entityName, basePath, modo: 'crud' }),
      });
      const dtoResult = await dtoResponse.json();
      results.dto = {
        success: dtoResponse.ok,
        message: dtoResult.message || dtoResult.error || 'Error al crear DTOs',
      };
      if (!dtoResponse.ok) {
        console.error('Error creando DTOs:', dtoResult.error);
      }
    } catch (error) {
      results.dto = { success: false, message: 'Error de conexión', error: String(error) };
    }

    // 2. Crear Mapper
    try {
      const mapperResponse = await fetch(`${origin}/api/crear-mapper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, basePath }),
      });
      const mapperResult = await mapperResponse.json();
      results.mapper = {
        success: mapperResponse.ok,
        message: mapperResult.message || mapperResult.error || 'Error al crear mapper',
      };
      if (!mapperResponse.ok) {
        console.error('Error creando mapper:', mapperResult.error);
      }
    } catch (error) {
      results.mapper = { success: false, message: 'Error de conexión', error: String(error) };
    }

    // 3. Crear Repository
    try {
      const repositoryResponse = await fetch(`${origin}/api/crear-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, basePath }),
      });
      const repositoryResult = await repositoryResponse.json();
      results.repository = {
        success: repositoryResponse.ok,
        message: repositoryResult.message || repositoryResult.error || 'Error al crear repository',
      };
      if (!repositoryResponse.ok) {
        console.error('Error creando repository:', repositoryResult.error);
      }
    } catch (error) {
      results.repository = { success: false, message: 'Error de conexión', error: String(error) };
    }

    // 4. Crear Service
    try {
      const serviceResponse = await fetch(`${origin}/api/crear-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, basePath, traza }),
      });
      const serviceResult = await serviceResponse.json();
      results.service = {
        success: serviceResponse.ok,
        message: serviceResult.message || serviceResult.error || 'Error al crear service',
      };
      if (!serviceResponse.ok) {
        console.error('Error creando service:', serviceResult.error);
      }
    } catch (error) {
      results.service = { success: false, message: 'Error de conexión', error: String(error) };
    }

    // 5. Crear Controller
    try {
      const controllerResponse = await fetch(`${origin}/api/crear-controller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, basePath }),
      });
      const controllerResult = await controllerResponse.json();
      results.controller = {
        success: controllerResponse.ok,
        message: controllerResult.message || controllerResult.error || 'Error al crear controller',
      };
      if (!controllerResponse.ok) {
        console.error('Error creando controller:', controllerResult.error);
      }
    } catch (error) {
      results.controller = { success: false, message: 'Error de conexión', error: String(error) };
    }

    // 6. Crear seed de Funcion/endPoints (F9-M2/F10-M2: sin este seed el
    //    PermissionGuard responde 403 para todos los usuarios tras arrancar)
    try {
      const seedResponse = await fetch(`${origin}/api/crear-seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, basePath }),
      });
      const seedResult = await seedResponse.json();
      results.seed = {
        success: seedResponse.ok,
        message: seedResult.message || seedResult.error || 'Error al crear el seed',
      };
      if (!seedResponse.ok) {
        console.error('Error creando seed:', seedResult.error);
      }
    } catch (error) {
      results.seed = { success: false, message: 'Error de conexión', error: String(error) };
    }

    // Verificar si todos fueron exitosos
    const allSuccess = Object.values(results).every(r => r?.success);
    const someSuccess = Object.values(results).some(r => r?.success);

    if (allSuccess) {
      return NextResponse.json({ 
        success: true, 
        message: `CRUD completo para ${entityName} creado exitosamente (incluye seed de permisos; reinicie la api para sembrar)`,
        results
      });
    } else if (someSuccess) {
      return NextResponse.json({ 
        success: true, 
        message: `CRUD para ${entityName} creado parcialmente. Algunos componentes ya existían o tuvieron errores.`,
        results
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: `No se pudo crear el CRUD para ${entityName}. Todos los componentes ya existen o tuvieron errores.`,
        results
      }, { status: 400 });
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: `Error al crear el CRUD completo: ${message}` 
    }, { status: 500 });
  }
}
