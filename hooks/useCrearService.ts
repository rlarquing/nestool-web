import { useState } from 'react';

interface ServiceData {
    entityName: string;
    basePath: string;
    traza?: boolean;
}

interface CrearServiceResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearService = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearService = async (serviceData: ServiceData): Promise<CrearServiceResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-service', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(serviceData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el service';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el service';
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
        crearService,
        loading,
        error,
    };
};
