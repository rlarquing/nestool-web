import { useEffect, useState } from 'react';
import { RutaRepository, RutaEntity } from '@/localdb/entity';

const repo = new RutaRepository();

export function useRutaApi() {
  const [ruta, setRuta] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRuta() {
      setLoading(true);
      const rutas = await repo.getAll();
      if (rutas.length > 0) {
        setRuta(rutas[0].ruta);
      }
      setLoading(false);
    }
    fetchRuta();
  }, []);

  const guardarRuta = async (nuevaRuta: string) => {
    let rutas = await repo.getAll();
    if (rutas.length === 0) {
      await repo.add(new RutaEntity(1, nuevaRuta));
    } else {
      await repo.update(rutas[0].id, { ruta: nuevaRuta });
    }
    setRuta(nuevaRuta);
  };

  return { ruta, guardarRuta, loading };
} 