# 🛠️ REGISTRO DE FIXES — Auditoría nestool-web vs api-base-nestjs

> Registro vivo de los hallazgos de la auditoría de las 10 funciones del menú.
> **Modelo de referencia**: `api-base-nestjs` @ `ca1da1e` (rama `master`).
> **Generador auditado**: `nestool-web` @ `5f76561`.
> **Convención**: `F<n>-<Ccrit|Mmed|mmin>-<num>` — se marca ✅ al quedar arreglado y verificado.
> Auditoría **estática** (lógica + template); los casos marcados 🧪 tienen además evidencia E2E real capturada.

---

## Leyenda de severidad

| Nivel | Significado |
|---|---|
| 🔴 CRÍTICO | El fichero generado no compila, corrompe otros ficheros, o el runtime falla seguro |
| 🟡 MEDIO | Compila pero se desvía del modelo api-base o rompe convenciones/BD |
| 🟢 MENOR | Cosmético o de calidad (Swagger, ejemplos, estilo) |

---

## Función 1 — Nueva entity (`/api/crear-entidad` + `template/entity.template.ts` + `utilities/entity-utils.ts`)

**Veredicto: NO CUMPLE.** El camino de columnas es sólido; todo el subsistema de relaciones genera código roto.

### F1-C1 — 🔴 `$name` literal en las relaciones inversas inyectadas
- **Ficheros**: `template/many-to-one.template.ts`, `template/one-to-many.template.ts`, `template/one-to-one.template.ts`, `template/many-to-many.template.ts` + los `.replace()` de `app/api/crear-entidad/route.ts` (líneas ~110-140).
- **Problema**: los templates usan `$name` (o `$entidad`) **2+ veces**, pero `String.replace()` con string solo sustituye la **primera** ocurrencia. Las inversas inyectadas en la entidad destino quedan con `(variable) => $name.propiedad` y `@JoinColumn({ name: '$name_id' })` literales.
- **Consecuencia**: `Cannot find name '$name'` al compilar la api; FK con nombre literal.
- **Fix propuesto**: usar `.replaceAll()` o regex global en todos los reemplazos de placeholders (`/\\$name/g`), y renombrar placeholders de forma única por ocurrencia.
- 🧪 **Estado**: ⬜ pendiente

### F1-C2 — 🔴 Callback de inversa erróneo en el lado directo (`generarRelacion`)
- **Fichero**: `utilities/entity-utils.ts` → `generarRelacion()` (OneToMany y ManyToOne).
- **Problema**: emite `@ManyToOne(() => MenuEntity, menuEntity => menuEntity.menu)` — apunta a una propiedad que **no existe** en la entidad relacionada (usa el nombre propio del atributo) y la variable es el nombre de clase minusculizado completo (`menuentity`).
- **Modelo api-base**: `@ManyToOne(() => MenuEntity, (menu) => menu.traducciones, { onDelete: 'CASCADE', nullable: false })` — el callback apunta a la **colección inversa** en la entidad relacionada.
- **Fix propuesto**: el callback debe apuntar al nombre de la propiedad inversa inyectada en el destino (el generador YA conoce ese nombre: el que calcula para la inversa). Corregir también camelCase de la variable.
- **Estado**: ⬜ pendiente

### F1-C3 — 🔴 JoinTable ManyToMany con columnas invertidas
- **Fichero**: `utilities/entity-utils.ts` → `generarRelacion()` caso ManyToMany.
- **Problema**: `joinColumn.name` sale con `<entidadRelacionada>_id` (es la del OTRO lado) y `inverseJoinColumn.name` con `<nombreAtributo>_id`; pivot con nombre `<relacionada>_<atributo>`.
- **Modelo api-base** (`user.entity.ts`): pivot `user_funcion`, `joinColumn: user_id` (este lado), `inverseJoinColumn: funcion_id`, callback `(funcion) => funcion.users`, `{ eager: false }`.
- **Fix propuesto**: derivar `joinColumn` del nombre de la ENTIDAD ACTUAL (snake), `inverseJoinColumn` de la relacionada (sin plural del atributo), pivot `<actual>_<relacionada>`, y añadir el callback inverso + `eager: false`.
- **Estado**: ⬜ pendiente

### F1-C4 — 🔴 La inyección de inversas corrompe entidades existentes sanas
- **Fichero**: `app/api/crear-entidad/route.ts` (bloque "NUEVO", líneas ~79-169).
- **Problema**: read-modify-write sobre la entity destino real (p. ej. `MenuEntity` de la api) insertando los bloques rotos de F1-C1. `destinoAlreadyHasRelation = content.includes('@')` es siempre true → la única barrera anti-duplicado es un `includes()` exacto sensible a espacios.
- **Fix propuesto**: (a) arreglar primero los templates (F1-C1); (b) idempotencia real: marcar la inyección con un comentario ancla (`// [nestool] inversa de <X>`) y buscar por ancla; (c) validar el resultado con el parser de TS antes de escribir; (d) jamás tocar ficheros que no parseen.
- **Estado**: ⬜ pendiente

### F1-C5 — 🔴 Caso OneToMany: nombra la FK del hijo con el nombre de la colección del padre
- **Fichero**: `app/api/crear-entidad/route.ts` case `'OneToMany'` → `.replace('$atributo', `${atributo.nombreAtributo}!: ${origenEntityName};`)`.
- **Problema**: si creo `Menu.traducciones`, inyecta en el hijo `traducciones!: MenuEntity` (ManyToOne con nombre de colección). Al crear después el hijo real con su `menu!: MenuEntity`, quedan **dos ManyToOne a la misma tabla pidiendo la misma columna** → TypeORM explota.
- **Fix propuesto**: la FK del hijo debe nombrarse con el nombre de la entidad padre en minúscula (o preguntarlo); no reutilizar el nombre de la colección.
- **Estado**: ⬜ pendiente

### F1-M1 — 🟡 Opciones FK en el lado equivocado
- **Problema**: `onDelete: 'CASCADE'` y `nullable` solo aparecen en los templates de la **inversa**; el lado dueño (que tiene la FK) sale sin opciones → sin cascade, `nullable=true` implícito en BD.
- **Modelo api-base**: las opciones viven en el lado dueño (`menu-traduccion.entity.ts`: `{ onDelete: 'CASCADE', nullable: false }`); la inversa no lleva JoinColumn ni opciones FK.
- **Fix propuesto**: mover CASCADE/nullable a `generarRelacion` (lado dueño) y quitarlos de los templates de inversa.
- **Estado**: ⬜ pendiente

### F1-M2 — 🟡 `@JoinColumn()` sin `name` y `@Column` sin `name:` → columnas camelCase
- **Problema**: genera columna FK `menuId` / columnas de atributos sin nombre explícito; la api usa snake_case explícito (`menu_id`, `name: 'codigo'`).
- **Fix propuesto**: derivar `name` snake_case en `generarColumna` y en los JoinColumn del lado dueño.
- **Estado**: ⬜ pendiente

### F1-M3 — 🟡 `toString()` generado devuelve `''`
- **Problema**: el `entityToDto` de la api construye `dtoToString` con `entity.toString()` → labels vacíos en menús/lecturas.
- **Modelo api-base**: cada entity implementa `toString()` con un campo representativo (`return this.nombre;`).
- **Fix propuesto**: el form de "Nueva entity" ya pide atributos → usar el primer atributo string no-nulo como retorno de `toString()` (fallback `id`).
- **Estado**: ⬜ pendiente

### F1-M4 — 🟡 Entidad destino auto-creada sin GenericEntity ni SchemaEnum
- **Problema**: si la entity relacionada no existe, se crea una clase pelada `export class X { }` sin heredar `GenericEntity`, sin schema, sin orderBy — no es una entity del estilo de la api.
- **Fix propuesto**: usar el mismo `genericEntity` template completo para la auto-creación.
- **Estado**: ⬜ pendiente

### F1-M5 — 🟡 Constructor excluye TODAS las relaciones
- **Problema**: el route excluye relaciones del constructor por diseño; el modelo api-base (`menu-traduccion.entity.ts`) SÍ incluye ManyToOne/OneToOne requeridas en el constructor (`constructor(menu: MenuEntity, idioma: IdiomaEntity, label: string)`). Solo las colecciones (OneToMany/ManyToMany) quedan fuera.
- **Impacto**: condiciona el mapper (#6) — sin constructor no hay forma de pasar la relación al crear la entity.
- **Fix propuesto**: incluir OneToOne/ManyToOne en constructor (con su tipo entity); excluir solo colecciones.
- **Estado**: ⬜ pendiente

### F1-m1 — 🟢 `@Entity` sin `orderBy: { id: 'ASC' }`; unique via Column en vez de `@Index('UQ_...')`
- **Fix propuesto**: añadir orderBy al template; opcionalmente generar `@Index` de clase cuando `unico` (modelo: `UQ_<tabla>_<col>` con `where '"activo" = true'`).
- **Estado**: ⬜ pendiente

---

## Función 2 — Editar entity (`/api/actualizar-entidad`)

**Veredicto: NO CUMPLE — la más destructiva.** No edita: reescribe el fichero desde cero.

### F2-C1 — 🔴 Reescritura destructiva: pierde @Index, orderBy, métodos propios, inversas y toString real
- **Problema**: `generateUpdatedEntityContent()` reconstruye todo el fichero. Una pasada de "editar" sobre `UserEntity` eliminaría `validatePassword()`; sobre `IdiomaEntity` eliminaría `@Index('UQ_idioma_codigo', ...)`.
- **Fix propuesto**: edición quirúrgica con el parser de TS (reemplazar solo el bloque de atributos + constructor), conservando el resto literal.
- **Estado**: ⬜ pendiente

### F2-C2 — 🔴 Imports duplicados
- **Problema**: `extractImports()` conserva las líneas existentes y `generateImportsForAttributes()` re-inyecta `Column, Entity` + typeorm **siempre** → `Duplicate identifier 'Column'`.
- **Fix propuesto**: fusionar identificadores por módulo (parsear imports existentes y unir sets) o regenerarlos todos desde cero a partir de los atributos.
- **Estado**: ⬜ pendiente

### F2-C3 — 🔴 `getInverseProperty()` devuelve `'id'` (stub confeso)
- **Problema**: todo `@OneToMany` queda `x => x.id`.
- **Fix propuesto**: resolver la inversa real buscando en la entity relacionada la propiedad cuyo tipo sea la entity actual (mismo criterio que #1); si no se encuentra, omitir el callback.
- **Estado**: ⬜ pendiente

### F2-C4 — 🔴 Renombra la tabla (snake_case perdido)
- **Problema**: `entityName.toLowerCase().replace('entity','')` → `menutraduccion` en vez de `menu_traduccion` → TypeORM la interpreta como otra tabla (drift/datos "desaparecidos").
- **Fix propuesto**: usar `formatearNombre(eliminarSufijo(nombre,'Entity'), '_')`.
- **Estado**: ⬜ pendiente

### F2-C5 — 🔴 Degrada nomencladores
- **Problema**: `extends GenericEntity` hardcodeado → editar una entity que hereda `GenericNomencladorEntity` la degrada (pierde nombre/descripcion y el mecanismo del generic).
- **Fix propuesto**: detectar la clase base actual y conservarla; conservar también el prefijo de tabla `nom_` si existe.
- **Estado**: ⬜ pendiente

### F2-M1 — 🟡 Columna requerida sale sin `nullable: false`
- **Problema**: solo emite `nullable: true` cuando `nulo`; las requeridas quedan con default TypeORM (nullable) → todo nullable en BD.
- **Fix propuesto**: emitir `nullable: ${!attr.nulo}` siempre (como hace `generarColumna` de #1, que es correcto).
- **Estado**: ⬜ pendiente

### F2-M2 — 🟡 Constructor con colecciones OneToMany como params requeridos; props sin `!`
- **Problema**: compila (el constructor asigna), pero semánticamente las colecciones no se pasan en constructor (modelo: solo escalares + relaciones dueñas).
- **Estado**: ⬜ pendiente (se resuelve junto a F1-M5 y F2-C1)

### F2-M3 — 🟡 Import de relación con ruta rota para multi-palabra
- **Problema**: `attr.rEntity.toLowerCase().replace('entity','')` → `menutraduccion` en vez de `menu-traduccion` (kebab).
- **Fix propuesto**: `formatearNombre(eliminarSufijo(rEntity,'Entity'), '-')`.
- **Estado**: ⬜ pendiente

---

## Función 3 — Crear nomenclador (`/api/crear-nomenclador`)

**Veredicto: NO CUMPLE (nomenclador inerte).** Entity y enum bien; wiring de repository incompatible con la api.

### F3-C1 — 🔴 Inyecta `@InjectRepository` en el repository GENÉRICO (clase plana no-@Injectable)
- **Fichero**: bloque "ACTUALIZAR generic-nomenclador.repository.ts".
- **Problema**: (1) no importa `InjectRepository` → no compila; (2) `GenericNomencladorRepository` en la api es una clase plana con mapa dinámico, no un provider con DI; (3) rompería los `super()` de los concretos futuros.
- **Modelo api-base**: repository **concreto** que extiende `GenericNomencladorRepository`, inyecta su `@InjectRepository(X)` y se registra con `registerRepository(name, repo)`; se da de alta en `export const repository` de `persistence.service.ts`.
- **Fix propuesto**: eliminar el parche al genérico; generar `<nombre>.repository.ts` concreto (extiende la base, `super(); this.registerRepository('<nombre>', repo)`) + alta en `export const repository`.
- **Estado**: ⬜ pendiente

### F3-C2 — 🔴 Nomenclador inerte: nadie registra el repo en el mapa
- **Problema**: sin repository concreto, `getRepository('<nombre>')` lanza `NotFoundException` en todo CRUD. El menú sí se crea (el `main.ts` itera `NomencladorTypeEnum`) → nacimiento a medias.
- **Fix propuesto**: ver F3-C1.
- **Estado**: ⬜ pendiente

### F3-C3 — 🟡→🔴 Schema por defecto `public` rompe la cadena de detección
- **Problema**: el template deja `SchemaEnum.$schema` con fallback `'public'`; si el usuario no elige `MOD_NOMENCLATOR`, la entity no contiene el literal que `esNomenclador()` (crear-dto) grepea → el generador de DTOs deja de tratarla como nomencladora silenciosamente.
- **Fix propuesto**: fijar/por defecto `MOD_NOMENCLATOR` en la creación de nomencladores (la UI puede ofrecer cambiarlo, pero el default del dominio es ese).
- **Estado**: ⬜ pendiente

### F3-m1 — 🟢 Tabla con prefijo `nom_` sin anclaje en la api; sin orderBy
- **Estado**: ⬜ pendiente (decidir convención con el propietario)

### ✅ Cumple
Hereda `GenericNomencladorEntity` · kebab-case · 409 si existe · `index.ts` · entrada en `NomencladorTypeEnum` (regex válida para el fichero real; `main.ts` la consume).

---

## Función 4 — Nuevo DTO (`/api/crear-dto` modo `nuevo`)

**Veredicto: NO CUMPLE.** 🧪 Evidencia E2E: `mi-cosa.dto.ts` generado.

### F4-C1 — 🔴 Atributo opcional sin `@IsOptional()` → 400 en runtime
- **Problema**: `generarAtributoDto()` caso `esOpcional` emite `detalle?: string` con `@IsString` pero **sin** `@IsOptional()` → class-validator rechaza el campo ausente ("debe ser un texto") aunque nadie lo envíe.
- **Evidencia**: `detalle?: string` con solo `@IsString` en el DTO generado.
- **Fix propuesto**: emitir `@IsOptional()` (e importarlo) para `esOpcional` y `esNulo`.
- **Estado**: ⬜ pendiente

### F4-m1 — 🟢 Opcionales con `@ApiProperty` en vez de `@ApiPropertyOptional` (la api usa este último); indentación de 1 espacio; sin `example` coherente por tipo
- **Estado**: ⬜ pendiente

### ✅ Cumple
`!` en requeridos · `i18nValidationMessage('validation.*')` (claves existen en es/en) · imports sin duplicar en el caso requerido · index barrel con guard.

---

## Función 5 — DTOs para un CRUD (`/api/crear-dto` modo `crud`)

**Veredicto: NO CUMPLE.** 🧪 Evidencia E2E: `create-pivot.dto.ts`, `create-tarea.dto.ts`, `update-tarea.dto.ts` generados.

### F5-C1 — 🔴 `@IsNotEmpty()` emitido pero NO importado cuando las relaciones requeridas son lo único requerido
- **Problema**: línea ~346 excluye las relaciones del set de imports (`&& !tipo.startsWith('relation')`) pero el bloque CREATE **sí** emite `@IsNotEmpty()` para relaciones requeridas (línea ~382).
- **Evidencia**: `create-pivot.dto.ts` importa `{IsOptional, IsNumber}` y usa `@IsNotEmpty()` dos veces → `Cannot find name 'IsNotEmpty'`.
- **Modelo api-base** (`create-menu-traduccion.dto.ts`): `menuId!: number` lleva `@IsNotEmpty()` + `@IsNumber()` y el import correspondiente.
- **Fix propuesto**: quitar la exclusión de relaciones en la condición del import (las relaciones requeridas también necesitan IsNotEmpty).
- **Estado**: ⬜ pendiente

### F5-C2 — 🔴 Relación a nomenclador: `campo!: ReadNomencladorDto` sin import y contra la convención de ids
- **Problema**: `generateCrudAttributes` convierte relaciones hacia entities con `MOD_NOMENCLATOR` al tipo `ReadNomencladorDto`, pero **nunca inyecta su import** (el import solo se añade cuando la ENTITY completa es nomencladora) → no compila. Además la api **no usa** `ReadNomencladorDto` en ningún Create/Update DTO: la convención es por **id**.
- **Evidencia**: `estado!: ReadNomencladorDto` en create y update de Tarea (4 ficheros afectados).
- **Fix propuesto**: tratar las relaciones a nomenclador igual que las demás: `number` (M:1/1:1) o `number[]` (M:N).
- **Estado**: ⬜ pendiente

### F5-M1 — 🟡 Update DTO "todo opcional" cuando el modelo mantiene los requeridos
- **Problema**: el generador emite todos los campos con `@IsOptional()`; la api (`update-idioma.dto.ts`, `update-menu-traduccion.dto.ts`) mantiene `@IsNotEmpty` en los campos requeridos del create (semántica PUT).
- **Fix propuesto**: replicar la opcionalidad del create en el update (solo opcionales reales quedan `?`).
- **Estado**: ⬜ pendiente

### F5-M2 — 🟡 Nomenclatura de relaciones: `menu!: number` vs `menuId!: number` del modelo
- **Problema**: la api nombra los ids de relación con sufijo `Id` (`menuId`, `idiomaId`, `roles`); el generador usa el nombre de propiedad de la entity. Coherente internamente, pero rompe la convención documental y de Swagger de la api.
- **Fix propuesto**: decidir convención con el propietario; si se adopta `<relacion>Id`, propagar al mapper (#6).
- **Estado**: ⬜ pendiente (decisión de propietario)

### F5-m1 — 🟢 `@ApiProperty({required:false})` vs `@ApiPropertyOptional`; sin `example` en modo crud; imports sin usar en update (`IsNumber` cuando no aplica)
- **Estado**: ⬜ pendiente

### ✅ Cumple
Relaciones como ids (number/number[]) para no-nomenclador ✓ · `!`/`?` según nulabilidad ✓ · i18n ✓ (claves existen) · IsOptional garantizado en update ✓ · UpdateMultiple con id requerido numérico ✓ (existe el patrón en la api) · Read DTO con constructor posicional ✓ (solo difiere en opcionalidad, compila).

---

## Pendiente de auditar (se registrará aquí)

- [ ] Función 6 — Crear mapper
- [ ] Función 7 — Crear repository
- [ ] Función 8 — Crear service
- [ ] Función 9 — Crear controlador
- [ ] Función 10 — CRUD completo (orquestador)

## Decisiones pendientes del propietario

1. **F5-M2**: ¿adoptar sufijo `Id` en los campos de relación de DTOs (`menuId`) como la api, o mantener el nombre de propiedad?
2. **F3-m1**: ¿prefijo de tabla `nom_` para nomencladores o tabla sin prefijo?
3. **F1-M5/F2-M2**: ¿incluir relaciones dueñas (M:1/1:1) en el constructor de la entity como hace `menu-traduccion.entity.ts`?
