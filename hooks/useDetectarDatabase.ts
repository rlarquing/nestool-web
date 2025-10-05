import { useState, useEffect } from 'react';

interface DatabaseInfo {
    databaseType: string;
    configFound: boolean;
}

export const useDetectarDatabase = (basePath: string | null) => {
    const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const detectarDatabase = async () => {
        if (!basePath) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/detectar-database', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ basePath }),
            });

            const result = await response.json();

            if (response.ok) {
                setDatabaseInfo(result);
            } else {
                setError(result.error || 'Error al detectar la base de datos');
            }
        } catch (err) {
            setError('Error de conexión al detectar la base de datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (basePath) {
            detectarDatabase();
        }
    }, [basePath]);

    return {
        databaseInfo,
        loading,
        error,
        detectarDatabase,
    };
}; 