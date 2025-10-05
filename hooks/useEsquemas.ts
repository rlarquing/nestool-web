import { useState } from 'react';

export function useEsquemas(rutaApi: string | null) {
  const [esquemas, setEsquemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEsquemas = async () => {
    if (!rutaApi) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leer-esquemas', {
        method: 'POST',
        body: JSON.stringify({ basePath: rutaApi }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setEsquemas(data.values || []);
      } else {
        setError(data.error || 'Error desconocido');
        setEsquemas([]);
      }
    } catch (e: any) {
      setError(e.message);
      setEsquemas([]);
    }
    setLoading(false);
  };

  return { esquemas, fetchEsquemas, loading, error };
} 