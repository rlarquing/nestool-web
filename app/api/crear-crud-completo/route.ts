import { NextRequest, NextResponse } from 'next/server';

interface CrudResult {
  dto?: { success: boolean; message: string; error?: string };
  mapper?: { success: boolean; message: string; error?: string };
  repository?: { success: boolean; message: string; error?: string };
  service?: { success: boolean; message: string; error?: string };
  controller?: { success: boolean; message: string; error?: string };
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

    // 1. Crear DTOs para el CRUD
    try {
      const dtoResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/crear-dto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityName, basePath }),
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
      const mapperResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/crear-mapper`, {
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
      const repositoryResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/crear-repository`, {
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
      const serviceResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/crear-service`, {
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
      const controllerResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/crear-controller`, {
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

    // Verificar si todos fueron exitosos
    const allSuccess = Object.values(results).every(r => r?.success);
    const someSuccess = Object.values(results).some(r => r?.success);

    if (allSuccess) {
      return NextResponse.json({ 
        success: true, 
        message: `CRUD completo para ${entityName} creado exitosamente`,
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
