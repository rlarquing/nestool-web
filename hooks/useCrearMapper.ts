import { useState } from 'react';

interface MapperData {
    entityName: string;
    basePath: string;
}

interface CrearMapperResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearMapper = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearMapper = async (mapperData: MapperData): Promise<CrearMapperResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-mapper', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(mapperData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el mapper';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el mapper';
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
        crearMapper,
        loading,
        error,
    };
};
