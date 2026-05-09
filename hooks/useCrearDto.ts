import { useState } from 'react';

interface AtributoDto {
    nombreAtributo: string;
    tipoDato: string;
    dtoReferencia?: string;
    nuloOpcional: 'esNulo' | 'noNulo' | 'esOpcional';
    descripcion: string;
    ejemplo: string;
}

interface DtoData {
    dtoName: string;
    atributos: AtributoDto[];
    basePath: string;
    modo: 'nuevo' | 'crud';
    esNomenclador?: boolean;
}

interface CrearDtoResult {
    success: boolean;
    message: string;
    filePath?: string;
    error?: string;
}

export const useCrearDto = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearDto = async (dtoData: DtoData): Promise<CrearDtoResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/crear-dto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dtoData),
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: result.message,
                    filePath: result.filePath,
                };
            } else {
                const errorMessage = result.error || 'Error al crear el DTO';
                setError(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                    message: '',
                };
            }
        } catch (err) {
            const errorMessage = 'Error de conexión al crear el DTO';
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
        crearDto,
        loading,
        error,
    };
};
