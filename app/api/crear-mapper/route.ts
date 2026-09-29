import { NextRequest, NextResponse } from 'next/server';
import { crearMapper } from '@/generadores/crear-mapper';

// F10-m1: la lógica vive en generadores/crear-mapper.ts (llamables sin HTTP por
// el orquestador); esta ruta solo traduce HTTP <-> llamada directa.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        return await crearMapper(body);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: `Error al crear el mapper: ${message}` }, { status: 500 });
    }
}
