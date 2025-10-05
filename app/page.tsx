"use client"
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { useRutaApi } from '@/hooks/useRutaApi';
import { toast } from 'sonner';

const apiPathSchema = z.object({
  apiPath: z.string().min(1, 'La ruta es requerida.')
});

export default function Home() {
  const { ruta, guardarRuta, loading } = useRutaApi();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!loading) {
      setInputValue(ruta || '');
    }
  }, [ruta, loading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = apiPathSchema.safeParse({ apiPath: inputValue });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    await guardarRuta(inputValue.trim());
    toast.success('¡Ruta guardada correctamente!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2">
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-md xl:max-w-md mx-auto p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Selecciona la ruta del API NestJS</h1>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="api-path" className="block text-sm font-medium mb-1">Ruta del API <span className="text-red-500">*</span></label>
            <Input
              id="api-path"
              type="text"
              placeholder="Ej: D:/proyectos/mi-api-nest"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="mb-2"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>Guardar ruta</Button>
        </form>
        {ruta && (
          <div className="mt-6 text-green-700 text-center break-all">
            <strong>Ruta seleccionada:</strong> {ruta}
          </div>
        )}
      </div>
    </div>
  );
}
