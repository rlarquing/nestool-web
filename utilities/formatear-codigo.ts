import { format } from 'prettier';

// F9-m1: los artefactos generados deben pasar prettier igual que el modelo
// real (api-base). Opciones ESPEJO del .prettierrc de la api-base:
//   { "singleQuote": true, "trailingComma": "all" }
// (printWidth/semi por defecto = 80/true, los mismos del modelo).
//
// Si prettier no pudiera parsear (no debería: el contenido ya compila en
// los E2E), se devuelve el contenido original y la verificación tsc del
// orquestador sigue siendo la fuente de verdad.

export async function formatearCodigo(contenido: string, fichero: string): Promise<string> {
    try {
        return await format(contenido, {
            filepath: fichero,
            singleQuote: true,
            trailingComma: 'all',
        });
    } catch {
        return contenido;
    }
}
