import { useState } from 'react';

interface Atributo {
    nombreAtributo: string;
    tipoDato: string;
    length?: string;
    integer?: boolean;
    rEntity?: string;
    tipoRelacion?: string;
    nulo?: boolean;
    unico?: boolean;
}

interface ObtenerAtributosResponse {
    entityName: string;
    atributos: Atributo[];
    content: string;
}

interface ActualizarEntidadRequest {
    basePath: string;
    entityName: string;
    atributos: Atributo[];
    esquema?: string;
}

interface ActualizarEntidadResponse {
    success: boolean;
    message: string;
    entityName: string;
    atributosCount: number;
}

export function useEditarEntidad() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const obtenerAtributosEntidad = async (basePath: string, entityName: string): Promise<ObtenerAtributosResponse | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/obtener-atributos-entidad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    basePath,
                    entityName
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al obtener atributos de la entidad');
            }

            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const actualizarEntidad = async (request: ActualizarEntidadRequest): Promise<ActualizarEntidadResponse | null> => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/actualizar-entidad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al actualizar la entidad');
            }

            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        obtenerAtributosEntidad,
        actualizarEntidad,
        clearError: () => setError(null)
    };
}
