import { useState } from 'react';

interface ControllerData {
    entityName: string;
    basePath: string;
}

interface CrearControllerResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearController = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearController = async (controllerData: ControllerData): Promise<CrearControllerResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-controller', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(controllerData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el controller';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el controller';
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
        crearController,
        loading,
        error,
    };
};
