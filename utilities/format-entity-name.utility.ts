/**
 * Convierte un nombre de entidad a formato kebab-case sin el sufijo "Entity"
 * @param entityName Nombre de la entidad (ej: UserEntity, UserRolEntity)
 * @returns Nombre en kebab-case (ej: user, user-rol)
 */
export function formatEntityName(entityName: string): string {
  // Remover "Entity" del final si existe
  let name = entityName.replace(/Entity$/, '');

  // Convertir de PascalCase a kebab-case
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Insertar - entre minúscula y mayúscula
    .toLowerCase();
}