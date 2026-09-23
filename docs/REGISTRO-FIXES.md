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

## Función 6 — Crear mapper (`/api/crear-mapper`)

**Veredicto: NO CUMPLE para entidades con relaciones; el camino de columnas simples funciona.**

### F6-C1 — 🔴 Entidades con relaciones: mapper inservible (constructor incompleto, sin resolución de relaciones)
- **Problema**: la ruta usa un template inline "simple" cuyos parámetros salen SOLO de los `@Column`. Para una entidad relacional estilo `menu-traduccion` genera `new MenuTraduccionEntity(createDto.label)` cuando el constructor de la entity requiere `(menu, idioma, label)` → `Expected 3 arguments`. Además no resuelve relaciones (ni valida 404 con i18n) ni mapea `entity.menu?.id` en el Read.
- **Modelo api-base** (`menu-traduccion.mapper.ts`): inyecta su PROPIO repository y resuelve con `findMenuById`/`findIdiomaById` + `NotFoundException(traducir(...))`; `entityToDto` mapea ids (`entity.menu?.id`).
- **Fix propuesto**: detectar relaciones en la entity; usar la rama relacional (inyección de repos + helpers + NotFound i18n + mapeo por id); template simple solo para entidades puras.
- **Estado**: ⬜ pendiente

### F6-C2 — 🔴 El template relacional (`mepperRelacion`) es código muerto; la ruta duplica el template simple inline
- **Problema**: `template/mapper.template.ts` exporta `mepperSinRelacion`/`mepperRelacion` (con typo "mepper") pero la ruta **nunca lo importa**: tiene su propia copia inline del template simple. El template con soporte de relaciones (inyección de repos) jamás se usa → riesgo de drift doble.
- **Fix propuesto**: única fuente de verdad: la ruta importa de `template/` y elige rama según tenga o no relaciones la entity; corregir typos.
- **Estado**: ⬜ pendiente

### F6-C3 — 🔴 Regex de atributos frágil + fallback que fabrica atributos + sin validar que la entity exista
- **Problema**: `/@Column\([^)]*\)\s*\n\s*(\w+)([!?])?:/g` falla con decorador y propiedad en la misma línea, paréntesis anidados (`default: now()`, strings con `)`) o `@Column(...)` de una línea. Si matchea PARCIAL, la lista queda desalineada y el constructor recibe argumentos en posiciones equivocadas (**corrupción silenciosa**, sin error de compilación si los tipos coinciden). Si no matchea NADA: fallback `["nombre","descripcion"]` — atributos que quizá no existen ni en entity ni en DTO. Y si el fichero de entity NO existe, no hay error: genera un mapper con import roto.
- **Fix propuesto**: parseo robusto (parser TS o regex multilinea con balance); error 422 si la entity no existe o no se detecta ningún atributo; jamás fabricar atributos.
- **Estado**: ⬜ pendiente

### F6-M1 — 🟡 `const dtoToString` muerto y `async` innecesario en el mapper simple
- **Problema**: el template declara `const dtoToString: string = X.toString();` y luego pasa `X.toString()` OTRA vez al ReadDto (variable muerta + doble llamada; no rompe build porque la api no activa `noUnusedLocals`). Los 3 métodos van `async` sin `await`; el modelo es síncrono salvo que haya relaciones.
- **Fix propuesto**: usar `dtoToString` como primer argumento (o eliminarlo); `async`/`Promise` solo en la rama relacional.
- **Estado**: ⬜ pendiente

### F6-m1 — 🟢 Formato: `export {XMapper}` sin espacios en index vs api `export { XMapper }`; código generado sin pasar por prettier de la api
- **Estado**: ⬜ pendiente

### ✅ Cumple
Ficheros kebab-case · imports correctos (`../../persistence/entity`, `../../shared/dto`) · firma de `entityToDto` (toString, id, attrs…) correcta · guard 409 · alta en `index.ts` con guard.

---

## Función 7 — Crear repository (`/api/crear-repository`)

**Veredicto: NO CUMPLE (registro/exports rotos). El template base es correcto.**

### F7-C1 — 🔴 El repository queda PROVISTO pero NUNCA EXPORTADO desde PersistenceModule
- **Problema**: el parche a `persistence.module.ts` agrega la clase a `providers` y DESPUÉS chequea `if (!moduleContent.includes(repositoryClassName))` para `exports` — la condición ya es falsa tras el insert en providers → `exports` jamás se actualiza.
- **Consecuencia**: el primer service que inyecte `XRepository` (fuera de PersistenceModule) → `Nest can't resolve dependencies` en bootstrap.
- **Fix propuesto**: guardas independientes por array, o mejor: no parchear el module (ver F7-C2).
✅ **Estado**: CORREGIDO (fase 1). Se eliminó el parcheo de persistence.module.ts; el registro ahora alimenta forFeature/providers/exports vía el array dinámico. Verificado con tsc --noEmit sobre copia real de la api (0 errores nuevos).

### F7-C2 — 🔴 Parchea `persistence.module.ts` en vez del registro dinámico `persistence.service.ts`
- **Problema**: la api registra repositories DINÁMICAMENTE: `export const repository = [...]` en `persistence.service.ts`, consumido por `forFeature([...entity])`, `providers: [...repository]` y `exports: [...repository]`. `crear-entidad` ya actualiza el array `entity` de ese registro, pero `crear-repository` NO actualiza el array `repository` y en su lugar mete la clase estáticamente en el module → doble fuente de verdad, fuera del modelo de la api.
- **Fix propuesto**: agregar la clase a `export const repository = [...]` de `persistence.service.ts` (mismo patrón que `crear-entidad` usa para `entity`); no tocar `persistence.module.ts`.
✅ **Estado**: CORREGIDO (fase 1). crear-repository ahora actualiza el import './repository' y el array `export const repository` de persistence.service.ts (mismo patrón probado de crear-entidad).

### F7-C3 — 🔴 Repos relacionales: faltan las inyecciones auxiliares y los helpers de resolución
- **Problema**: el template solo inyecta su propio `Repository<XEntity>`. El modelo (`menu-traduccion.repository.ts`) inyecta además `Repository<MenuEntity>`/`Repository<IdiomaEntity>` y expone `findMenuById`/`findIdiomaById` (filtro `activo: true`) que el mapper usa para validar y 404 con i18n.
- **Fix propuesto**: si la entity tiene relaciones M:1/1:1, inyectar los repos relacionados y generar los helpers `find<Relacion>ById` (las entities ya están en `forFeature` vía registro dinámico).
- **Estado**: ⬜ pendiente

### F7-M1 — 🟡 `extraerNombresRelaciones` puede perder relaciones → `super()` sin joins → nulls silenciosos
- **Problema**: si el decorador y la propiedad están en la misma línea, o si entre ambos hay otra anotación/comentario, la relación se pierde del array `['menu','idioma']` → `findAll` sin `leftJoinAndSelect` → ReadDto con relaciones null sin error.
- **Fix propuesto**: parser TS para extraer relaciones; probar contra las entities reales multi-línea de la api.
- **Estado**: ⬜ pendiente

### F7-m1 — 🟢 `import {Repository }` con espacio extra; index sin espacios `{XRepository}` vs `{ XRepository }`; `super(repo, [])` con array vacío en vez de omitir el 2º argumento (aceptable, `relations?` opcional)
✅ **Estado**: CORREGIDO (fase 1). Import normalizado, `super(repo)` sin array vacío cuando no hay relaciones, index con formato { X }.

### ✅ Cumple
Estructura del template correcta (`extends GenericRepository<X> implements IRepository<X>`, `@InjectRepository`, `super(repo, [relations])` con nombres de propiedad reales) · guard 409 · alta en `index.ts` · kebab-case.

---

## Función 8 — Crear service (`/api/crear-service`)

**Veredicto: NO CUMPLE por registro. El template es correcto (el más fiel de los 10).**

### F8-C1 — 🔴 El regex del parche no matchea `core.service.ts` real → el service NUNCA se registra
- **Problema**: `providers:\s*\[([^\]]*)\]` busca `providers:` CON DOS PUNTOS; `core.service.ts` declara `export const providers = [...]` (con `=`). El match es null → no se agrega al array. Resultado: se añade el import (queda sin uso) y el service queda huérfano → DI failure al inyectarlo.
- **Fix propuesto**: parchear el array real: regex `export const providers\s*=\s*\[([^\]]*)\]`, o registrar service+mapper con el mecanismo del F8-C2.
✅ **Estado**: CORREGIDO (fase 1). Regex apuntado al array real `export const providers = [...]`; verificado en E2E (ProductoService en el array).

### F8-C2 — 🔴 Nadie registra el MAPPER en `core.service.ts` (brecha transversal con #6)
- **Problema**: la api registra PARES `(XService, XMapper)` en `export const providers`. `crear-service` solo registra (intenta) el service; `crear-mapper` no toca `core.service.ts` → aunque F8-C1 se arregle, el mapper sigue sin registrar → `Nest can't resolve dependencies of the XService (?)`.
- **Fix propuesto**: registrar el mapper junto al service (extender esta ruta o `crear-mapper`).
✅ **Estado**: CORREGIDO (fase 1). crear-mapper ahora registra el mapper (import + array) en core.service.ts; verificado en E2E (ProductoMapper).

### F8-M1 — 🟡 Parche regex frágil y doble fuente de verdad (mismo patrón que F7-C2)
- **Problema**: `core.service.ts` es un array estático formateado por prettier; cualquier reformateo rompe el regex. La api consume `providers` desde `core.service.ts` — el generador no debería depender del formato exacto.
- **Fix propuesto**: un único "registrar slice" con parser TS + anclas idempotentes que actualice los 3 registros (`persistence.service.ts`, `core.service.ts`, `api.service.ts`).
- **Estado**: ⬜ pendiente

### ✅ Cumple
Template fiel al modelo (`extends GenericService<X>`, `super(configService, repo, mapper, logHistoryService, traza)`) · imports correctos · `traza` default true · guard 409 · alta en `index.ts`.

---

## Función 9 — Crear controller (`/api/crear-controller`)

**Veredicto: NO CUMPLE — el fichero generado no compila y el registro es incorrecto.**

### F9-C1 — 🔴 Placeholder `$import` jamás sustituido → `Cannot find name '$import'`
- **Problema**: el template incluye una línea `$import` (línea ~22/17) que la ruta NUNCA reemplaza (no hay `replace(/\$import/g, ...)`) → el fichero generado contiene la expresión `$import` → TS2304.
- **Fix propuesto**: eliminar la línea del template o sustituirla por cadena vacía.
✅ **Estado**: CORREGIDO (fase 1). Línea $import eliminada del template (ruta + template/).

### F9-C2 — 🔴 Identificador en minúscula: `import {idiomaController}` vs clase exportada `IdiomaController`
- **Problema**: el parche a `api.module.ts` usa `import {${nombreLower}Controller}` y agrega `${nombreLower}Controller` al array `controllers`, pero la clase generada es `IdiomaController` (ver `controllerClassName`) → "Module has no exported member 'idiomaController'" + referencia indefinida. `crear-service` no tiene este bug (usa `serviceClassName`).
- **Fix propuesto**: usar `controllerClassName`.
✅ **Estado**: CORREGIDO (fase 1). El parche usa controllerClassName (clase exportada real).

### F9-C3 — 🔴 Parchea `api.module.ts` estático en vez del registro dinámico `api.service.ts`
- **Problema**: la api declara `controllers: [...controller]` consumiendo `export const controller = [...]` de `api.service.ts`. Aun arreglando F9-C2, meter la clase directo en el module duplica la fuente de verdad (mismo anti-patrón que F7-C2/F8-C1).
- **Fix propuesto**: actualizar `export const controller = [...]` de `api.service.ts`.
✅ **Estado**: CORREGIDO (fase 1). Se parchea `export const controller = [...]` de api.service.ts; api.module.ts ya no se toca. Verificado en E2E.

### F9-M1 — 🟡 `header == key` en ListadoDto: encabezados con claves crudas
- **Problema**: el modelo separa `header = ['id','Codigo','Nombre','Defecto']` (labels) de `key = ['id','codigo','nombre','defecto']` (claves); el generador pone los nombres de atributo crudos en AMBOS → los listados muestran camelCase como encabezados.
- **Fix propuesto**: derivar labels (capitalizar o pedir "label" por atributo en el form) y separar header de key.
- **Estado**: ⬜ pendiente

### F9-M2 — 🟡 Endpoints sin seed de Funcion/endPoint → 403 para todos los usuarios
- **Problema**: `PermissionGuard` exige que `controller.servicio` (metadata de `@Servicio`) exista entre las funciones de los roles (BD). La api siembra funciones ('Gestión de idiomas' + endPoints); el generador no crea ese seed → el CRUD recién generado es inaccesible hasta siembra manual.
- **Fix propuesto**: generar seed opcional (Funcion + endPoints + asignación al rol admin) o documentar el paso.
- **Estado**: ⬜ pendiente

### F9-m1 — 🟢 Tag pluralizado con `+ 's'` ingenua; indentación del template no pasa prettier; import de la entity solo usado como type-param (aceptable)
- **Estado**: ⬜ pendiente

### ✅ Cumple
Set de endpoints espejo del modelo (`/`, `/:id`, `POST /elementos/multiples`, `POST /`, `POST /multiple`, `POST /importar/elementos`, `PATCH /:id`, `PATCH /elementos/multiples`, `POST /filtrar`, `POST /buscar`) · `@Servicio('idioma','findAll')` correcto · `super(service, paginationService, ruta)` correcto · `updateMultiple → Promise<ResponseDto>` correcto (coincide con generic.controller) · guards + Swagger + i18n-style responses correctos · guard 409.

---

## Función 10 — CRUD completo (`/api/crear-crud-completo`)

**Veredicto: NO CUMPLE como orquestador: encadena 5 generadores rotos y reporta éxito sin verificar.**

### F10-C1 — 🔴 Reporta `success: true` (200) aunque la api quede sin compilar
- **Problema**: cada sub-ruta solo valida la ESCRITURA de ficheros; no hay verificación posterior (parseo TS, `tsc --noEmit`). Con F5/F6/F7/F8/F9 activos, un flujo "exitoso" entrega una api que no compila ni arranca, y el usuario ve "CRUD completo creado exitosamente".
- **Fix propuesto**: tras generar, validar (parsear los ficheros tocados como mínimo; ideal `tsc --noEmit`) y reportar el estado REAL; fallar si algo no parsea.
- **Estado**: ⬜ pendiente

### F10-C2 — 🔴 Hereda TODOS los defectos de las funciones 4–9 (no tiene solución propia)
- **Problema**: el valor del botón es ensamblar la cadena entity→controller; hoy la cadena NO se ensambla: repo provisto pero no exportado (F7-C1), service sin registrar (F8-C1), mapper sin registrar (F8-C2), controller con `$import` y registro roto (F9-C1/C2/C3).
- **Fix propuesto**: dependencia dura de los fixes 4–9 + test E2E "la api generada compila".
- **Estado**: ⬜ pendiente

### F10-M1 — 🟡 Sin atomicidad ni cleanup; `someSuccess` devuelve `success: true` con mensaje ambiguo
- **Problema**: si un paso falla (409/500), los ficheros previos quedan; la respuesta 200 "parcial" se presta a confusión.
- **Fix propuesto**: modo all-or-nothing (rollback de lo creado) o reporte estructurado claro con acción por paso.
- **Estado**: ⬜ pendiente

### F10-M2 — 🟡 No genera seed de funciones/endPoints (ver F9-M2) → "CRUD completo" termina en 403
- **Estado**: ⬜ pendiente

### F10-m1 — 🟢 Self-fetch HTTP secuencial (5 round-trips); serían llamadas directas a funciones; bajo riesgo
- **Estado**: ⬜ pendiente

### ✅ Cumple
Pasa `dtoName` + `modo: 'crud'` a crear-dto (contrato correcto) · propaga `traza` al service · estructura `results` por paso (buena base para el reporte real).

---

## Patrones transversales confirmados (2ª tanda, funciones 6–10)

1. **La api se registra dinámicamente; el generador parchea estáticamente (o no parchea)**: `persistence.service.ts` (`export const entity/repository`), `core.service.ts` (`export const providers`) y `api.service.ts` (`export const controller`) SON el mecanismo de registro. El generador: actualiza solo `entity`; parchea el module con regex que no matchea el formato real o con bugs de secuencia (F7-C1, F8-C1, F9-C3).
2. **Cadena DI nunca completa**: para una slice nueva hacen falta 5 registros; el generador no completa ninguno de los 3 de core/api → ningún CRUD generado llega a arrancar, aunque sus ficheros individuales compilaran.
3. **Éxito reportado = fichero escrito**, nunca "compila"/"arranca" (F10-C1).
4. **Placeholders sin sustituir y stubs** reaparecen (F9-C1 `$import`; ya visto en F2-C3).

## Estado global de la auditoría

| # | Función | Veredicto |
|---|---|---|
| 1 | Nueva entity | ❌ NO CUMPLE |
| 2 | Editar entity | ❌ NO CUMPLE (la más destructiva) |
| 3 | Crear nomenclador | ❌ NO CUMPLE (nomenclador inerte) |
| 4 | Nuevo DTO | ❌ NO CUMPLE (evidencia E2E 🧪) |
| 5 | DTOs CRUD | ❌ NO CUMPLE (evidencia E2E 🧪) |
| 6 | Crear mapper | ❌ NO CUMPLE (con relaciones) |
| 7 | Crear repository | ❌ NO CUMPLE (exports/registro) |
| 8 | Crear service | ❌ NO CUMPLE (registro) |
| 9 | Crear controller | ❌ NO CUMPLE (no compila) |
| 10 | CRUD completo | ❌ NO CUMPLE (orquesta los 9 anteriores) |

**10/10 funciones NO CUMPLEN.** Prioridad de fix sugerida: F9-C1/C2 y F8-C1 (baratos y bloquean todo) → F7-C1/C2 → F6-C1/C3 → F5-C1/C2 y F4-C1 → F1-C1..C5 → F2 (replantear como edición quirúrgica) → F3 (repository concreto nomenclador) → F10 (verificación post-generación).

## Decisiones pendientes del propietario

1. **F5-M2**: ¿adoptar sufijo `Id` en los campos de relación de DTOs (`menuId`) como la api, o mantener el nombre de propiedad?
2. **F3-m1**: ¿prefijo de tabla `nom_` para nomencladores o tabla sin prefijo?
3. **F1-M5/F2-M2**: ¿incluir relaciones dueñas (M:1/1:1) en el constructor de la entity como hace `menu-traduccion.entity.ts`?

---

## Fase de corrección — registro de avance

### Lote 1 (cadena de registro) — ✅ APLICADO Y VERIFICADO
- **Fixes**: F7-C1, F7-C2, F7-m1, F8-C1, F8-C2, F9-C1, F9-C2, F9-C3.
- **Verificación E2E** (copia limpia de api-base + `bun install` + `tsc --noEmit` baseline vs post-generación):
  - Generado CRUD completo de `Producto` (entity simple, 4 columnas) vía `/api/crear-entidad` + `/api/crear-crud-completo`.
  - **0 errores nuevos en `src/`** (baseline tenía solo errores preexistentes en `test/` por supertest+node types).
  - Registros verificados: `ProductoRepository` en `export const repository` (persistence.service.ts), `ProductoService`+`ProductoMapper` en `export const providers` (core.service.ts), `ProductoController` en `export const controller` (api.service.ts).
  - NOTA: el arranque runtime de la api requiere PostgreSQL (no disponible en el sandbox); la paridad de registro con las slices propias de la api + compilación estricta es la evidencia de esta fase.
- **Extras corregidos fuera de los ítems originales**:
  - **F9-C4 (nuevo, 🔴→✅)**: `@ApiNotFoundResponse({ status: 404, ... })` — Swagger 11 no acepta `status` en ese decorador (`ApiResponseNoStatusOptions`) → error de compilación. La api real lo usa SIN status. Corregido en template (3 bloques).
  - **F1-C6 (nuevo, 🔴→✅)**: `SchemaEnum.${esquema}` pasaba el valor en minúsculas (`SchemaEnum.public` no existe → TS2551). Ahora se uppercasea con fallback `PUBLIC`.
  - **UI (fuera de alcance, 🔴→✅)**: importación circular `localdb/entity/generic.repository.ts → localdb/db.ts → localdb/entity` (TDZ `GenericRepository before initialization`) dejaba la home del generador en 500. Roto el ciclo quitando el import de entidades de db.ts.

### 🔐 SEC-1 — 🔴 Credenciales reales trackeadas en el repo api-base (fuera del generador)
- **Fichero**: `api-base-nestjs/.env.local` (trackeado en git; `.gitignore` solo excluye `.env`).
- **Problema**: contiene `EMAIL_ID=rlarquing@gmail.com` + `EMAIL_PASS=<app password de Gmail de 16 chars>` en el historial y HEAD del repo público/privado de GitHub.
- **Acción requerida del propietario**: (1) revocar YA esa app password en la cuenta Google; (2) `git rm --cached .env.local` + añadir `.env.local`/`.env*` a `.gitignore`; (3) purgar el fichero del historial (`git filter-repo` / BFG) y rotar cualquier otra credencial del fichero.
- **Estado**: ⬜ pendiente (requiere decisión/acción del propietario; tocar historial es destructivo)
