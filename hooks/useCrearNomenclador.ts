import { useState } from 'react';

interface NomencladorData {
    entityName: string;
    esquema?: string;
    basePath: string;
}

interface CrearNomencladorResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearNomenclador = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearNomenclador = async (nomencladorData: NomencladorData): Promise<CrearNomencladorResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-nomenclador', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(nomencladorData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el nomenclador';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el nomenclador';
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
                message: '',
            };
        } finally {
            setLoading(false);
        }
    };

    return {
        crearNomenclador,
        loading,
        error,
    };
};
