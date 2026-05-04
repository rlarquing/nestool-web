import { useState } from 'react';

interface FetchEntidadesOptions {
  filtrarSinCrud?: boolean;
  excluirNomencladores?: boolean;
}

export function useEntidades(rutaApi: string | null) {
  const [entidades, setEntidades] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntidades = async (options: FetchEntidadesOptions = {}) => {
    if (!rutaApi) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/listar-entidades', {
        method: 'POST',
        body: JSON.stringify({ 
          basePath: rutaApi,
          filtrarSinCrud: options.filtrarSinCrud,
          excluirNomencladores: options.excluirNomencladores
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setEntidades(data.entities || []);
      } else {
        setError(data.error || 'Error desconocido');
        setEntidades([]);
      }
    } catch (e: any) {
      setError(e.message);
      setEntidades([]);
    }
    setLoading(false);
  };

  return { entidades, fetchEntidades, loading, error };
}