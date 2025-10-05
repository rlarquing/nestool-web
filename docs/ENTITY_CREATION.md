# Sistema de Creación de Entidades

Este sistema permite crear entidades de TypeORM de forma interactiva a través de una interfaz web, basándose en el template `genericEntity` y la lógica del archivo `entity.js`.

## Componentes Principales

### 1. API Endpoint (`/api/crear-entidad`)
- **Archivo**: `app/api/crear-entidad/route.ts`
- **Función**: Procesa los datos del formulario y genera el archivo de entidad
- **Características**:
  - Valida los datos de entrada
  - Genera código TypeORM basado en el template
  - Maneja relaciones (OneToOne, OneToMany, ManyToOne, ManyToMany)
  - Actualiza automáticamente el módulo persistence.module.ts
  - Actualiza el index.ts del directorio entity

### 2. Hook Personalizado (`useCrearEntidad`)
- **Archivo**: `hooks/useCrearEntidad.ts`
- **Función**: Maneja la comunicación con el API y el estado de carga
- **Características**:
  - Estado de loading y error
  - Tipado TypeScript completo
  - Manejo de errores centralizado

### 3. Componente de Vista Previa (`EntityPreview`)
- **Archivo**: `components/EntityPreview.tsx`
- **Función**: Muestra una vista previa de la entidad que se va a crear
- **Características**:
  - Visualización de atributos y decoradores
  - Información general de la entidad
  - Badges para tipos de datos y decoradores

## Flujo de Trabajo

1. **Usuario llena el formulario**:
   - Nombre de la entidad
   - Esquema (opcional)
   - Atributos con sus tipos y configuraciones

2. **Validación en tiempo real**:
   - El formulario valida que no exista la entidad
   - Se muestran errores de validación
   - La vista previa se actualiza dinámicamente

3. **Creación de la entidad**:
   - Se envían los datos al API endpoint
   - Se procesa el template `genericEntity`
   - Se generan los decoradores TypeORM apropiados
   - Se crea el archivo `.entity.ts`

4. **Actualización automática**:
   - Se actualiza el `persistence.module.ts`
   - Se agrega la exportación al `index.ts`
   - Se manejan las importaciones necesarias

## Tipos de Atributos Soportados

### Tipos Básicos
- `string` - Con opción de longitud
- `number` - Con opción de entero/decimal
- `Date` - Timestamp
- `Timestamp` - Timestamp
- `boolean` - Booleano
- `Geometry` - Geometría (PostGIS)

### Relaciones
- `OneToOne` - Relación uno a uno
- `OneToMany` - Relación uno a muchos
- `ManyToOne` - Relación muchos a uno
- `ManyToMany` - Relación muchos a muchos

### Configuraciones
- `nullable` - Permite valores nulos
- `unique` - Valores únicos
- `length` - Longitud para strings
- `integer` - Tipo entero para números

## Template Base

El sistema utiliza el template `genericEntity` que incluye:

```typescript
import {Column, Entity, $typeorm} from "typeorm";
import {GenericEntity} from "./generic.entity";
import { SchemaEnum } from '../../database/schema/schema.enum';
$import

@Entity('$entidad', { schema: SchemaEnum.$schema })
export class $nameEntity extends GenericEntity {

    $atributos

    constructor($parametros) {
        super();
        $thisAtributos
    }

   public toString(): string {
        return '';
    }
}
```

## Archivos Generados/Modificados

1. **Archivo de entidad**: `src/persistence/entity/{nombre}.entity.ts`
2. **Index de entidades**: `src/persistence/entity/index.ts`
3. **Módulo de persistencia**: `src/persistence/persistence.module.ts`

## Validaciones

- Nombre de entidad debe empezar con mayúscula
- Se requiere al menos un atributo
- Los atributos de relación deben tener entidad y tipo especificados
- Validación de existencia de entidad antes de crear

## Manejo de Errores

- Errores de validación en el frontend
- Errores de servidor con mensajes descriptivos
- Estados de carga para mejor UX
- Toast notifications para feedback

## Extensibilidad

El sistema está diseñado para ser extensible:

- Fácil agregar nuevos tipos de datos
- Plantillas personalizables
- Hooks reutilizables
- Componentes modulares 