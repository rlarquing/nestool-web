import { useState } from 'react';

interface CrudCompletoData {
    entityName: string;
    basePath: string;
    traza?: boolean;
}

interface CrudResultItem {
    success: boolean;
    message: string;
    error?: string;
}

interface CrudResults {
    dto?: CrudResultItem;
    mapper?: CrudResultItem;
    repository?: CrudResultItem;
    service?: CrudResultItem;
    controller?: CrudResultItem;
}

interface CrearCrudCompletoResult {
    success: boolean;
    message: string;
    results?: CrudResults;
    error?: string;
}

export const useCrearCrudCompleto = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<CrudResults | null>(null);

    const crearCrudCompleto = async (crudData: CrudCompletoData): Promise<CrearCrudCompletoResult> => {
        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const response = await fetch('/api/crear-crud-completo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(crudData),
            });

            const result = await response.json();

            if (response.ok) {
                setResults(result.results);
                return {
                    success: true,
                    message: result.message,
                    results: result.results,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el CRUD completo';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el CRUD completo';
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
        crearCrudCompleto,
        loading,
        error,
        results,
    };
};
