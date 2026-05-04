import { useState } from 'react';

interface RepositoryData {
    entityName: string;
    basePath: string;
}

interface CrearRepositoryResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearRepository = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearRepository = async (repositoryData: RepositoryData): Promise<CrearRepositoryResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-repository', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(repositoryData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el repository';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el repository';
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
        crearRepository,
        loading,
        error,
    };
};
