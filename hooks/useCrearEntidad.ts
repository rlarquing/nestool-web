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

interface EntityData {
    entityName: string;
    esquema?: string;
    atributos: Atributo[];
    basePath: string;
    databaseType?: string;
}

interface CrearEntidadResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearEntidad = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearEntidad = async (entityData: EntityData): Promise<CrearEntidadResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-entidad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entityData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear la entidad';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear la entidad';
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    };

    return {
        crearEntidad,
        loading,
        error,
    };
}; 