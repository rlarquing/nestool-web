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
- ✅ **Estado**: CORREGIDO (fase 3). Los templates de relación y los `.replace()` de una sola pasada desaparecieron: `generarRelacion`/`generarRelacionInversa` (utilities/entity-utils.ts) construyen el código directamente con parámetros explícitos, sin placeholders ni `String.replace`.

### F1-C3 — 🔴 JoinTable ManyToMany con columnas invertidas
- **Fichero**: `utilities/entity-utils.ts` → `generarRelacion()` caso ManyToMany.
- **Problema**: `joinColumn.name` sale con `<entidadRelacionada>_id` (es la del OTRO lado) y `inverseJoinColumn.name` con `<nombreAtributo>_id`; pivot con nombre `<relacionada>_<atributo>`.
- **Modelo api-base** (`user.entity.ts`): pivot `user_funcion`, `joinColumn: user_id` (este lado), `inverseJoinColumn: funcion_id`, callback `(funcion) => funcion.users`, `{ eager: false }`.
- **Fix propuesto**: derivar `joinColumn` del nombre de la ENTIDAD ACTUAL (snake), `inverseJoinColumn` de la relacionada (sin plural del atributo), pivot `<actual>_<relacionada>`, y añadir el callback inverso + `eager: false`.
- ✅ **Estado**: CORREGIDO (fase 3). El callback del lado dueño apunta a la colección inversa REAL que se inyecta en el destino (`pluralizarEntidad(hijo)` para M:1/M:N, singular para 1:1) y la variable es camelCase sin sufijo Entity (`(menu) => menu.menuTraducciones`).

### F1-C4 — 🔴 La inyección de inversas corrompe entidades existentes sanas
- **Fichero**: `app/api/crear-entidad/route.ts` (bloque "NUEVO", líneas ~79-169).
- **Problema**: read-modify-write sobre la entity destino real (p. ej. `MenuEntity` de la api) insertando los bloques rotos de F1-C1. `destinoAlreadyHasRelation = content.includes('@')` es siempre true → la única barrera anti-duplicado es un `includes()` exacto sensible a espacios.
- **Fix propuesto**: (a) arreglar primero los templates (F1-C1); (b) idempotencia real: marcar la inyección con un comentario ancla (`// [nestool] inversa de <X>`) y buscar por ancla; (c) validar el resultado con el parser de TS antes de escribir; (d) jamás tocar ficheros que no parseen.
- ✅ **Estado**: CORREGIDO (fase 3). Pivot `<actual>_<relacionada>` con `joinColumn` del lado ACTUAL e `inverseJoinColumn` del relacionado + callback inverso + `{ eager: false }` (modelo user.entity).

### F1-C5 — 🔴 Caso OneToMany: nombra la FK del hijo con el nombre de la colección del padre
- **Fichero**: `app/api/crear-entidad/route.ts` case `'OneToMany'` → `.replace('$atributo', `${atributo.nombreAtributo}!: ${origenEntityName};`)`.
- **Problema**: si creo `Menu.traducciones`, inyecta en el hijo `traducciones!: MenuEntity` (ManyToOne con nombre de colección). Al crear después el hijo real con su `menu!: MenuEntity`, quedan **dos ManyToOne a la misma tabla pidiendo la misma columna** → TypeORM explota.
- **Fix propuesto**: la FK del hijo debe nombrarse con el nombre de la entidad padre en minúscula (o preguntarlo); no reutilizar el nombre de la colección.
- ✅ **Estado**: CORREGIDO (fase 3). Edición quirúrgica: ancla idempotente `// [nestool] inversa de X.y`, chequeo de colisión de propiedad antes de inyectar, inserción por posición de clase (utilities/entity-edicion.ts) y **jamás se toca un fichero que no parsea**. Además crear-entidad ahora rechaza con 409 reescribir una entity existente.

### F1-M1 — 🟡 Opciones FK en el lado equivocado
- **Problema**: `onDelete: 'CASCADE'` y `nullable` solo aparecen en los templates de la **inversa**; el lado dueño (que tiene la FK) sale sin opciones → sin cascade, `nullable=true` implícito en BD.
- **Modelo api-base**: las opciones viven en el lado dueño (`menu-traduccion.entity.ts`: `{ onDelete: 'CASCADE', nullable: false }`); la inversa no lleva JoinColumn ni opciones FK.
- **Fix propuesto**: mover CASCADE/nullable a `generarRelacion` (lado dueño) y quitarlos de los templates de inversa.
- ✅ **Estado**: CORREGIDO (fase 3). La FK inyectada en el hijo se nombra con la entidad PADRE (`nota!: NotaEntity` con `nota_id`), no con el nombre de la colección. Verificado E2E (Nota → Tarea).

### F1-M2 — 🟡 `@JoinColumn()` sin `name` y `@Column` sin `name:` → columnas camelCase
- **Problema**: genera columna FK `menuId` / columnas de atributos sin nombre explícito; la api usa snake_case explícito (`menu_id`, `name: 'codigo'`).
- **Fix propuesto**: derivar `name` snake_case en `generarColumna` y en los JoinColumn del lado dueño.
- ✅ **Estado**: CORREGIDO (fase 3). `onDelete`/`nullable` viven en el lado dueño (ManyToOne directo y el ManyToOne inyectado por OneToMany); las inversas no llevan opciones FK ni JoinColumn.

### F1-M3 — 🟡 `toString()` generado devuelve `''`
- **Problema**: el `entityToDto` de la api construye `dtoToString` con `entity.toString()` → labels vacíos en menús/lecturas.
- **Modelo api-base**: cada entity implementa `toString()` con un campo representativo (`return this.nombre;`).
- **Fix propuesto**: el form de "Nueva entity" ya pide atributos → usar el primer atributo string no-nulo como retorno de `toString()` (fallback `id`).
- ✅ **Estado**: CORREGIDO (fase 3). `generarColumna` emite siempre `name: '<snake>'` y los JoinColumn del lado dueño `name: '<snake>_id'` (snake del atributo, convención menu-traduccion).

### F1-M4 — 🟡 Entidad destino auto-creada sin GenericEntity ni SchemaEnum
- **Problema**: si la entity relacionada no existe, se crea una clase pelada `export class X { }` sin heredar `GenericEntity`, sin schema, sin orderBy — no es una entity del estilo de la api.
- **Fix propuesto**: usar el mismo `genericEntity` template completo para la auto-creación.
- ✅ **Estado**: CORREGIDO (fase 3). `toString()` usa el primer atributo string del formulario (`return this.titulo;`), con `?? ''` si es nulable y `String(this.id)` como fallback.

### F1-M5 — 🟡 Constructor excluye TODAS las relaciones
- **Problema**: el route excluye relaciones del constructor por diseño; el modelo api-base (`menu-traduccion.entity.ts`) SÍ incluye ManyToOne/OneToOne requeridas en el constructor (`constructor(menu: MenuEntity, idioma: IdiomaEntity, label: string)`). Solo las colecciones (OneToMany/ManyToMany) quedan fuera.
- **Impacto**: condiciona el mapper (#6) — sin constructor no hay forma de pasar la relación al crear la entity.
- **Fix propuesto**: incluir OneToOne/ManyToOne en constructor (con su tipo entity); excluir solo colecciones.
- ✅ **Estado**: CORREGIDO (fase 3). La entidad destino auto-creada usa el template completo `genericEntity` (GenericEntity + SchemaEnum + orderBy + toString) y además se registra en index.ts y en `export const entity` de persistence.service.ts.

### F1-m1 — 🟢 `@Entity` sin `orderBy: { id: 'ASC' }`; unique via Column en vez de `@Index('UQ_...')`
- **Fix propuesto**: añadir orderBy al template; opcionalmente generar `@Index` de clase cuando `unico` (modelo: `UQ_<tabla>_<col>` con `where '"activo" = true'`).
- ✅ **Estado**: CORREGIDO (fase 3, resuelve la decisión pendiente del propietario según el fix propuesto). OneToOne/ManyToOne entran al constructor; colecciones fuera. ORDEN compartido requeridos-primero (TS1016): crear-entidad y crear-mapper usan `ordenRequeridoPrimero` para que el `new XEntity(...)` del mapper coincida posición a posición.

---

## Función 2 — Editar entity (`/api/actualizar-entidad`)

**Veredicto: NO CUMPLE — la más destructiva.** No edita: reescribe el fichero desde cero.

### F2-C1 — 🔴 Reescritura destructiva: pierde @Index, orderBy, métodos propios, inversas y toString real
- **Problema**: `generateUpdatedEntityContent()` reconstruye todo el fichero. Una pasada de "editar" sobre `UserEntity` eliminaría `validatePassword()`; sobre `IdiomaEntity` eliminaría `@Index('UQ_idioma_codigo', ...)`.
- **Fix propuesto**: edición quirúrgica con el parser de TS (reemplazar solo el bloque de atributos + constructor), conservando el resto literal.
- ✅ **Estado**: CORREGIDO (fase 3 parcial; fase 4 completa). Fase 3: `@Entity(..., { schema, orderBy: { id: 'ASC' } })` siempre; índice compuesto de clase `UQ_<tabla>_<cols>` solo cuando hay 2+ únicos. Fase 4: editar-entity ya NO reescribe nada — diff por nombre sobre el fichero real; los atributos existentes quedan byte a byte (métodos propios, @Index, herencia e inversas intactos por construcción).

### F2-C2 — 🔴 Imports duplicados
- **Problema**: `extractImports()` conserva las líneas existentes y `generateImportsForAttributes()` re-inyecta `Column, Entity` + typeorm **siempre** → `Duplicate identifier 'Column'`.
- **Fix propuesto**: fusionar identificadores por módulo (parsear imports existentes y unir sets) o regenerarlos todos desde cero a partir de los atributos.
- ✅ **Estado**: CORREGIDO (fase 4). La reescritura desapareció: los imports existentes no se tocan; los nuevos se fusionan con `fusionarImportsTypeorm` (sin duplicados) y los de entities relacionadas solo se añaden si no están. Tras eliminaciones se PODAN typeorm/entidades que quedaron sin uso.

### F2-C3 — 🔴 `getInverseProperty()` devuelve `'id'` (stub confeso)
- **Problema**: todo `@OneToMany` queda `x => x.id`.
- **Fix propuesto**: resolver la inversa real buscando en la entity relacionada la propiedad cuyo tipo sea la entity actual (mismo criterio que #1); si no se encuentra, omitir el callback.
- ✅ **Estado**: CORREGIDO (fase 4). El stub se eliminó junto con toda la generación ad-hoc de la ruta: las relaciones nuevas usan `generarRelacion`/`generarRelacionInversa` (los generadores corregidos de fase 3) con `coleccionInversa` calculada y ancla idempotente en el destino.

### F2-C4 — 🔴 Renombra la tabla (snake_case perdido)
- **Problema**: `entityName.toLowerCase().replace('entity','')` → `menutraduccion` en vez de `menu_traduccion` → TypeORM la interpreta como otra tabla (drift/datos "desaparecidos").
- **Fix propuesto**: usar `formatearNombre(eliminarSufijo(nombre,'Entity'), '_')`.
- ✅ **Estado**: CORREGIDO (fase 4). El decorador `@Entity` de un fichero existente JAMÁS se regenera (tabla/schema/índices intocados). Si la petición pide otro esquema se responde con un aviso y no se aplica. Ruta del fichero corregida a kebab real (ver F2-C7).

### F2-C5 — 🔴 Degrada nomencladores
- **Problema**: `extends GenericEntity` hardcodeado → editar una entity que hereda `GenericNomencladorEntity` la degrada (pierde nombre/descripcion y el mecanismo del generic).
- **Fix propuesto**: detectar la clase base actual y conservarla; conservar también el prefijo de tabla `nom_` si existe.
- ✅ **Estado**: CORREGIDO (fase 4). La herencia y los decoradores de clase (`@Entity`, `@Unique`, `@Index`…) no se regeneran nunca. E2E: entity que hereda `GenericNomencladorEntity` con `@Unique(['nombre'])` y schema `MOD_NOMENCLATOR` editada → byte-idéntica salvo el atributo añadido.

### F2-M1 — 🟡 Columna requerida sale sin `nullable: false`
- **Problema**: solo emite `nullable: true` cuando `nulo`; las requeridas quedan con default TypeORM (nullable) → todo nullable en BD.
- **Fix propuesto**: emitir `nullable: ${!attr.nulo}` siempre (como hace `generarColumna` de #1, que es correcto).
- ✅ **Estado**: CORREGIDO (fase 4). Los atributos NUEVOS pasan por `generarColumna` con `nulo` normalizado a booleano → `nullable: false/true` siempre explícito. Los existentes no se re-emitieren (quedan como estaban).

### F2-M2 — 🟡 Constructor con colecciones OneToMany como params requeridos; props sin `!`
- **Problema**: compila (el constructor asigna), pero semánticamente las colecciones no se pasan en constructor (modelo: solo escalares + relaciones dueñas).
- ✅ **Estado**: CORREGIDO (fase 4). Cirugía de constructor real: los añadidos escalares y relaciones unitarias (M:1/1:1) reciben param + asignación; los requeridos se insertan ANTES del primer opcional (TS1016); las colecciones nunca. Al eliminar, param y asignación se retiran (params por TEXTO, soporta una-línea y multi-línea). Si la entity no tiene constructor utilizable, se avisa y la propiedad sigue compilando (`!`/`?`).

### F2-M3 — 🟡 Import de relación con ruta rota para multi-palabra
- **Problema**: `attr.rEntity.toLowerCase().replace('entity','')` → `menutraduccion` en vez de `menu-traduccion` (kebab).
- **Fix propuesto**: `formatearNombre(eliminarSufijo(rEntity,'Entity'), '-')`.
- ✅ **Estado**: CORREGIDO (fase 4). Los imports de entities relacionadas usan kebab real; si el identificador ya estaba importado no se duplica.

### F2-C6 — 🔴→✅ (nuevo, fase 4) El flujo de edición no ve las propiedades `!` y al guardar las ELIMINARÍA
- **Problema**: el parser legacy de `obtener-atributos-entidad` (`/(\w+)\s*:/`) no matchea `titulo!: string` (el `!` rompe el anclaje) → la UI mostraba SOLO las propiedades nulables; guardar la entity habría invocado la eliminación quirúrgica de TODAS las requeridas.
- **Fix**: `obtener-atributos-entidad` reescrito sobre el parser robusto compartido (`parseEntityContent`); el round-trip es fiel en NOMBRES (y opciones capturables). E2E: MenuTraduccionEntity (2 relaciones unitarias + label, todas con `!`) carga las 3 y el round-trip es byte-idéntico.

### F2-C7 — 🔴→✅ (nuevo, fase 4) Ruta del fichero en minúsculas → 404 para entities multi-palabra
- **Problema**: `fileName.toLowerCase()` → `menutraduccion.entity.ts` no existe (el fichero real es `menu-traduccion.entity.ts`) → editar/descargar una entity multi-palabra fallaba con 404.
- **Fix**: `formatearNombre(eliminarSufijo(className,'Entity'), '-')` en `obtener-atributos-entidad` y `actualizar-entidad`.

---

## Función 3 — Crear nomenclador (`/api/crear-nomenclador`)

**Veredicto original: NO CUMPLE (nomenclador inerte).** Entity y enum bien; wiring de repository incompatible con la api. → **CORREGIDO (fase 5, ver Lote 5)**.

### F3-C1 — 🔴 Inyecta `@InjectRepository` en el repository GENÉRICO (clase plana no-@Injectable)
- **Fichero**: bloque "ACTUALIZAR generic-nomenclador.repository.ts".
- **Problema**: (1) no importa `InjectRepository` → no compila; (2) `GenericNomencladorRepository` en la api es una clase plana con mapa dinámico, no un provider con DI; (3) rompería los `super()` de los concretos futuros.
- **Modelo api-base**: repository **concreto** que extiende `GenericNomencladorRepository`, inyecta su `@InjectRepository(X)` y se registra con `registerRepository(name, repo)`; se da de alta en `export const repository` de `persistence.service.ts`.
- **Fix propuesto**: eliminar el parche al genérico; generar `<nombre>.repository.ts` concreto (extiende la base, `super(); this.registerRepository('<nombre>', repo)`) + alta en `export const repository`.
- **⚠️ REFINAMIENTO del modelo (hallazgo de la fase 5)**: el mapa `repositories` de `GenericNomencladorRepository` es **POR INSTANCIA** (`protected repositories = {}`) y la ÚNICA instancia consultada en runtime es la que `GenericNomencladorService` inyecta por token de clase. El fix propuesto original (concreto que **extiende** la base y se auto-registra) habría dejado ese mapa VACÍO → el CRUD genérico seguiría con 404. Modelo refinado: el concreto **NO extiende** la base; implementa `OnModuleInit` y registra su `Repository<X>` en la instancia **COMPARTIDA** (DI por token de clase ⇒ mismo singleton del service) vía `this.genericNomencladorRepository['registerRepository']('<nombre>', this.<x>Repository)` (acceso bracket deliberado: el método es protected).
- ✅ **Estado**: CORREGIDO (fase 5). Parche destructivo eliminado; `repositoryNomencladorTemplate` genera el repo concreto con registro en la instancia compartida.

### F3-C2 — 🔴 Nomenclador inerte: nadie registra el repo en el mapa
- **Problema**: sin repository concreto, `getRepository('<nombre>')` lanza `NotFoundException` en todo CRUD. El menú sí se crea (el `main.ts` itera `NomencladorTypeEnum`) → nacimiento a medias.
- **Fix aplicado (fase 5)**: repository concreto generado (ver F3-C1 refinado) + alta en `repository/index.ts` (con normalización de newline final) + import y array `export const repository` de `persistence.service.ts` (patrón F7) + entity en `export const entity` (helper compartido `registrarEntidadEnPersistence`). CONTRATO verificado contra main.ts/controller: valor del enum == nombre de registro == `:name` del controller.
- ✅ **Estado**: CORREGIDO (fase 5). E2E: `EstadoCivilRepository.onModuleInit() → registerRepository('estadoCivil', ...)`, `ESTADOCIVIL = 'estadoCivil'` en el enum.

### F3-C3 — 🟡→🔴 Schema por defecto `public` rompe la cadena de detección
- **Problema**: el template deja `SchemaEnum.$schema` con fallback `'public'`; si el usuario no elige `MOD_NOMENCLATOR`, la entity no contiene el literal que `esNomenclador()` (crear-dto) grepea → el generador de DTOs deja de tratarla como nomencladora silenciosamente.
- **Fix aplicado (fase 5)**: default `MOD_NOMENCLATOR` (uppercase, patrón F1-C6). Además la detección ya no depende del schema: `esNomenclador()` reconoce el marcador estructural `extends GenericNomencladorEntity` (crear-dto y listar-entidades, 2º y 3er punto de la cadena).
- ✅ **Estado**: CORREGIDO (fase 5).

### F3-m1 — 🟢 Tabla con prefijo `nom_` sin anclaje en la api; sin orderBy
- **Estado**: ⬜ pendiente (decisión del propietario; el template ya emite `nom_` de fábrica — si se decide quitar, es un cambio de una línea en `entity.template.ts`).

### ✅ Cumple
Hereda `GenericNomencladorEntity` · kebab-case · 409 si existe · `index.ts` · entrada en `NomencladorTypeEnum` (regex válida para el fichero real; `main.ts` la consume).

---

## Función 4 — Nuevo DTO (`/api/crear-dto` modo `nuevo`)

**Veredicto: NO CUMPLE.** 🧪 Evidencia E2E: `mi-cosa.dto.ts` generado.

### F4-C1 — 🔴 Atributo opcional sin `@IsOptional()` → 400 en runtime
- **Problema**: `generarAtributoDto()` caso `esOpcional` emite `detalle?: string` con `@IsString` pero **sin** `@IsOptional()` → class-validator rechaza el campo ausente ("debe ser un texto") aunque nadie lo envíe.
- **Evidencia**: `detalle?: string` con solo `@IsString` en el DTO generado.
- **Fix propuesto**: emitir `@IsOptional()` (e importarlo) para `esOpcional` y `esNulo`.
✅ **Estado**: CORREGIDO (fase 2). generarAtributoDto emite @IsOptional() e importa IsOptional para esOpcional y esNulo. E2E: ComentarioDto con 'detalle?: string' opcional correcto.

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
✅ **Estado**: CORREGIDO (fase 2). Eliminada la exclusión de relaciones del set de imports: las relaciones requeridas también registran IsNotEmpty. E2E: create-tarea.dto.ts importa y usa @IsNotEmpty().

### F5-C2 — 🔴 Relación a nomenclador: `campo!: ReadNomencladorDto` sin import y contra la convención de ids
- **Problema**: `generateCrudAttributes` convierte relaciones hacia entities con `MOD_NOMENCLATOR` al tipo `ReadNomencladorDto`, pero **nunca inyecta su import** (el import solo se añade cuando la ENTITY completa es nomencladora) → no compila. Además la api **no usa** `ReadNomencladorDto` en ningún Create/Update DTO: la convención es por **id**.
- **Evidencia**: `estado!: ReadNomencladorDto` en create y update de Tarea (4 ficheros afectados).
- **Fix propuesto**: tratar las relaciones a nomenclador igual que las demás: `number` (M:1/1:1) o `number[]` (M:N).
✅ **Estado**: CORREGIDO (fase 2). Las relaciones a nomencladores ahora son ids (number/number[]) como el resto; ReadNomencladorDto ya no aparece en ningún Create/Update. E2E: estado!: number en los 4 DTOs de Tarea (0 apariciones de ReadNomencladorDto).

### F5-M1 — 🟡 Update DTO "todo opcional" cuando el modelo mantiene los requeridos
- **Problema**: el generador emite todos los campos con `@IsOptional()`; la api (`update-idioma.dto.ts`, `update-menu-traduccion.dto.ts`) mantiene `@IsNotEmpty` en los campos requeridos del create (semántica PUT).
- **Fix propuesto**: replicar la opcionalidad del create en el update (solo opcionales reales quedan `?`).
✅ **Estado**: CORREGIDO (fase 2). El update replica la opcionalidad del create (campos requeridos con @IsNotEmpty). E2E: update-tarea.dto.ts mantiene titulo/producto/estado requeridos.

### F5-M2 — 🟡 Nomenclatura de relaciones: `menu!: number` vs `menuId!: number` del modelo
- **Problema**: la api nombra los ids de relación con sufijo `Id` (`menuId`, `idiomaId`, `roles`); el generador usa el nombre de propiedad de la entity. Coherente internamente, pero rompe la convención documental y de Swagger de la api.
- **Fix propuesto**: decidir convención con el propietario; si se adopta `<relacion>Id`, propagar al mapper (#6).
- **Estado**: ⬜ pendiente (decisión de propietario)

### F5-m1 — 🟢 `@ApiProperty({required:false})` vs `@ApiPropertyOptional`; sin `example` en modo crud; imports sin usar en update (`IsNumber` cuando no aplica)
- **Estado**: ⬜ pendiente

### ✅ Cumple
Relaciones como ids (number/number[]) para no-nomenclador ✓ · `!`/`?` según nulabilidad ✓ · i18n ✓ (claves existen) · IsOptional garantizado en update ✓ · UpdateMultiple con id requerido numérico ✓ (existe el patrón en la api) · Read DTO con constructor posicional ✓ (solo difiere en opcionalidad, compila).

---

### F5-C4 — 🔴→✅ El parser de entities perdía TODAS las relaciones con decoradores multi-línea (nuevo, detectado en E2E de fase 3)
- **Fichero**: `app/api/crear-dto/route.ts` → `parseEntityAttributes`.
- **Problema**: el walk-up de decoradores se cortaba en las líneas de continuación multi-línea (p. ej. `nullable: false,` matcheaba el guard "otra propiedad" → break) → las relaciones M:1/M:N caían como `tipoDato: string` (fallback de mapTypeScriptType) → los DTOs generaban `prioridad?: string` / `etiquetas?: string` en lugar de `number`/`number[]`. Es la causa de fondo del parche de F5-C3: el regex línea a línea no escala.
- **Fix aplicado (fase 3)**: `parseEntityAttributes` delega en el parser robusto compartido `parseEntityContent` (utilities/entity-parser.ts) — el mismo que usan crear-mapper y crear-repository. OneToMany sigue excluido de los DTOs (convención previa). Extra: captura `length` y `type: 'int'` de los @Column multi-línea.
- ✅ **Estado**: CORREGIDO (fase 3). Verificado E2E: ReadTareaDto ahora declara `prioridad?: number, etiquetas?: number[]`.

### F5-C5 — 🔴→✅ El naming de DTOs CRUD no quitaba el sufijo `Entity` (nuevo, detectado en la fase 5)
- **Fichero**: `app/api/crear-dto/route.ts` (modo crud).
- **Problema**: los llamadores reales pasan `MarcaEntity` (no `MarcaDto`); el nombre de clase se derivaba con un solo `eliminarSufijo(dtoName, 'Dto')` → se generaban `CreateMarcaEntityDto` / `create-marca-entity.dto.ts` contra la convención de la api Y DESALINEADO con controller/service, que derivan `CreateMarcaDto` → mismatch latente de la cadena completa.
- **Fix aplicado (fase 5)**: doble eliminarSufijo `eliminarSufijo(eliminarSufijo(dtoName, 'Dto'), 'Entity')`. NOTA de migración: proyectos generados antes pueden tener entradas rancias `*-entity.dto` en `shared/dto/index.ts`.
- ✅ **Estado**: CORREGIDO (fase 5). E2E: `dtoName: 'MarcaEntity'` → `create-marca.dto.ts` con `export class CreateMarcaDto`, y el controller generado importa exactamente `CreateMarcaDto`.

### F5-C6 — 🔴→✅ El Read DTO de un nomenclador NO compilaba (nuevo, detectado en la fase 5)
- **Fichero**: `app/api/crear-dto/route.ts` (modo crud, rama esNomenclador del read).
- **Problema**: el template canónico emite constructor `(dtoToString, id)` + re-declaración de `dtoToString`/`id` sin inicializador; la rama nomenclador inyectaba `super(id, nombre, descripcion, dtoToString)` con variables INEXISTENTES (TS2304) y las re-declaraciones caían en TS2564 (strict).
- **Fix aplicado (fase 5)**: el read del nomenclador es SOLO HERENCIA — `export class Read<X>Dto extends ReadNomencladorDto {}` (la base ya aporta id/nombre/descripcion/dtoToString y su constructor). Sin constructor, sin re-declaraciones; import ApiProperty solo si la entity tuviera atributos extra que decorar.
- ✅ **Estado**: CORREGIDO (fase 5). E2E: `read-estado-civil.dto.ts` heredado limpio; tsc 0 errores.

## Función 6 — Crear mapper (`/api/crear-mapper`)

**Veredicto: NO CUMPLE para entidades con relaciones; el camino de columnas simples funciona.**

### F6-C1 — 🔴 Entidades con relaciones: mapper inservible (constructor incompleto, sin resolución de relaciones)
- **Problema**: la ruta usa un template inline "simple" cuyos parámetros salen SOLO de los `@Column`. Para una entidad relacional estilo `menu-traduccion` genera `new MenuTraduccionEntity(createDto.label)` cuando el constructor de la entity requiere `(menu, idioma, label)` → `Expected 3 arguments`. Además no resuelve relaciones (ni valida 404 con i18n) ni mapea `entity.menu?.id` en el Read.
- **Modelo api-base** (`menu-traduccion.mapper.ts`): inyecta su PROPIO repository y resuelve con `findMenuById`/`findIdiomaById` + `NotFoundException(traducir(...))`; `entityToDto` mapea ids (`entity.menu?.id`).
- **Fix propuesto**: detectar relaciones en la entity; usar la rama relacional (inyección de repos + helpers + NotFound i18n + mapeo por id); template simple solo para entidades puras.
- ✅ **Estado**: CORREGIDO (fase 3). Rama relacional fiel a menu-traduccion.mapper: inyecta su propio repository, resuelve con `find<Rel>ById` + `NotFoundException(traducir(...))`, asigna en el update y mapea ids en el Read (`entity.menu?.id`, colecciones `?.map(x => x.id) ?? []`).

### F6-C2 — 🔴 El template relacional (`mepperRelacion`) es código muerto; la ruta duplica el template simple inline
- **Problema**: `template/mapper.template.ts` exporta `mepperSinRelacion`/`mepperRelacion` (con typo "mepper") pero la ruta **nunca lo importa**: tiene su propia copia inline del template simple. El template con soporte de relaciones (inyección de repos) jamás se usa → riesgo de drift doble.
- **Fix propuesto**: única fuente de verdad: la ruta importa de `template/` y elige rama según tenga o no relaciones la entity; corregir typos.
- ✅ **Estado**: CORREGIDO (fase 3). `template/mapper.template.ts` es la única fuente (mapperSimpleTemplate/mapperRelacionalTemplate, typos corregidos) y la ruta lo importa; el template simple inline de la ruta se eliminó.

### F6-C3 — 🔴 Regex de atributos frágil + fallback que fabrica atributos + sin validar que la entity exista
- **Problema**: `/@Column\([^)]*\)\s*\n\s*(\w+)([!?])?:/g` falla con decorador y propiedad en la misma línea, paréntesis anidados (`default: now()`, strings con `)`) o `@Column(...)` de una línea. Si matchea PARCIAL, la lista queda desalineada y el constructor recibe argumentos en posiciones equivocadas (**corrupción silenciosa**, sin error de compilación si los tipos coinciden). Si no matchea NADA: fallback `["nombre","descripcion"]` — atributos que quizá no existen ni en entity ni en DTO. Y si el fichero de entity NO existe, no hay error: genera un mapper con import roto.
- **Fix propuesto**: parseo robusto (parser TS o regex multilinea con balance); error 422 si la entity no existe o no se detecta ningún atributo; jamás fabricar atributos.
- ✅ **Estado**: CORREGIDO (fase 3). Parseo robusto compartido (utilities/entity-parser.ts: decoradores multi-línea, paréntesis anidados, strings, comentarios) verificado contra las 13 entities de api-base; 422 si la entity no existe o no parsea; el fallback `["nombre","descripcion"]` se eliminó.

### F6-M1 — 🟡 `const dtoToString` muerto y `async` innecesario en el mapper simple
- **Problema**: el template declara `const dtoToString: string = X.toString();` y luego pasa `X.toString()` OTRA vez al ReadDto (variable muerta + doble llamada; no rompe build porque la api no activa `noUnusedLocals`). Los 3 métodos van `async` sin `await`; el modelo es síncrono salvo que haya relaciones.
- **Fix propuesto**: usar `dtoToString` como primer argumento (o eliminarlo); `async`/`Promise` solo en la rama relacional.
- ✅ **Estado**: CORREGIDO (fase 3). Mapper simple síncrono (async/Promise solo en la rama relacional) y `dtoToString` usado como primer argumento del Read.

### F6-m1 — 🟢 Formato: `export {XMapper}` sin espacios en index vs api `export { XMapper }`; código generado sin pasar por prettier de la api
- ✅ **Estado**: CORREGIDO (fase 1 el formato de index `{ XMapper }`; fase 3 el resto). Los templates generan con indentación/quotes consistentes con la api; pasar por el prettier de la api sigue siendo paso manual del usuario.

### F6-C4 — 🔴→✅ (nuevo, fase 4) El `new XEntity(...)` usa el orden de DECLARACIÓN, no el del CONSTRUCTOR real
- **Problema**: el mapper calculaba el orden posicional con `ordenRequeridoPrimero(atributos)` sobre el orden de DECLARACIÓN. Tras una edición (F2) la relación nueva entra arriba del fichero pero el constructor conserva su orden histórico → `new ProductoEntity(categoria, codigo, ...)` vs `constructor(codigo, nombre, precio, categoria)` → asignaciones cruzadas silenciosas (categoria→codigo).
- **Fix**: `ordenSegunConstructor()` (utilities/entidad-sync.ts) — el mapper deriva el orden del CONSTRUCTOR REAL de la entity (única fuente de verdad posicional); fallback canónico requeridos-primero si no hay constructor utilizable. E2E: mapper regenerado tras editar → `new ProductoEntity(dto.codigo, dto.nombre, dto.precio, categoria, dto.descripcion)` coincidiendo posición a posición con el constructor.

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
- ✅ **Estado**: CORREGIDO (fase 3). Repositorio relacional: inyecta `@InjectRepository(Rel)` por cada relación unitaria (dedup por entidad, autorrelaciones excluidas) y expone `find<Rel>ById` con `activo: true` (modelo menu-traduccion.repository).

### F7-M1 — 🟡 `extraerNombresRelaciones` puede perder relaciones → `super()` sin joins → nulls silenciosos
- **Problema**: si el decorador y la propiedad están en la misma línea, o si entre ambos hay otra anotación/comentario, la relación se pierde del array `['menu','idioma']` → `findAll` sin `leftJoinAndSelect` → ReadDto con relaciones null sin error.
- **Fix propuesto**: parser TS para extraer relaciones; probar contra las entities reales multi-línea de la api.
- ✅ **Estado**: CORREGIDO (fase 3). `extraerNombresRelaciones` sustituido por el parser robusto compartido; verificado contra las entities multi-línea reales de la api (menu, funcion, user).

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
- ✅ **Estado**: CORREGIDO (lote 6). Nuevo placeholder `$headerLabel` (primera letra mayúscula, resto intacto — paridad con `'Codigo'` de idioma) sustituido por la ruta; `key` conserva las claves crudas. ORDEN DE SUSTITUCIÓN CRÍTICO: `$headerLabel` ANTES que `$header` (si no, `\$header` se come el prefijo y deja basura `…'activo'Label]` — hallado y corregido en la propia verificación E2E). Aplicado en el template inline de `crear-controller/route.ts` y sincronizado `template/controller.template.ts` (nota: hay DOS copias del template, mismo patrón de doble fuente que F8-M1).

### F9-M2 — 🟡 Endpoints sin seed de Funcion/endPoint → 403 para todos los usuarios
- **Problema**: `PermissionGuard` exige que `controller.servicio` (metadata de `@Servicio`) exista entre las funciones de los roles (BD). La api siembra funciones ('Gestión de idiomas' + endPoints); el generador no crea ese seed → el CRUD recién generado es inaccesible hasta siembra manual.
- **Fix propuesto**: generar seed opcional (Funcion + endPoints + asignación al rol admin) o documentar el paso.
- ✅ **Estado**: CORREGIDO (lote 6). **Refinamiento del modelo real (re-lectura de api-base `ca1da1e`)**: `parseController` (main.ts, dev) ya sincroniza SOLO los EndPoint de todos los controllers (ts-morph, incluye métodos heredados) pero NO crea Funcion ni asigna; `crearMenuAdministracion` está fija a 5 controllers y `crearMenuNomenclador` solo cubre el enum → para un CRUD genérico falta Menu+Funcion+rol. Fix: nueva ruta `/api/crear-seed` que genera `src/database/seed/crud-<nombre>.seed.ts` (función idempotente `sembrarCrud<X>(app)` espejo de `crearMenuNomenclador`: menú por label, endPoints por `findByController`, Funcion create-or-update con re-sync de endPoints, alta en rol ADMINISTRADOR por id) y engancha import + llamada en `main.ts` justo DESPUÉS de `await parseController(endPointService);` (los endPoints ya existen) y ANTES de `asignarFuncionesAdmin`. Idempotente (re-run 409 por fichero, main.ts no se duplica; si main ya referenciaba el seed solo regenera el fichero). Camino defensivo: si falta el ancla en main.ts → 400 + rollback del import, main.ts intacto.

### F9-m1 — 🟢 Tag pluralizado con `+ 's'` ingenua; indentación del template no pasa prettier; import de la entity solo usado como type-param (aceptable)
- **Estado**: ⬜ pendiente

### ✅ Cumple
Set de endpoints espejo del modelo (`/`, `/:id`, `POST /elementos/multiples`, `POST /`, `POST /multiple`, `POST /importar/elementos`, `PATCH /:id`, `PATCH /elementos/multiples`, `POST /filtrar`, `POST /buscar`) · `@Servicio('idioma','findAll')` correcto · `super(service, paginationService, ruta)` correcto · `updateMultiple → Promise<ResponseDto>` correcto (coincide con generic.controller) · guards + Swagger + i18n-style responses correctos · guard 409.

---

## Función 10 — CRUD completo (`/api/crear-crud-completo`)

**Veredicto: NO CUMPLE como orquestador: encadena 5 generadores rotos y reporta éxito sin verificar.**

### F5-C3 — 🔴→✅ El parser pierde atributos nulables con unión `T | null` (nuevo, detectado en E2E de fase 2)
- **Problema**: el regex de propiedades de `parseEntityAttributes` no aceptaba `nota?: string | null;` → los atributos nulables desaparecían SILENCIOSAMENTE de los 4 DTOs (pérdida de campos).
- **Fix aplicado**: regex extendido a `(?:\s*\|\s*null)?` + `mapTypeScriptType` normaliza la unión al tipo base.
- ✅ **Estado**: CORREGIDO (fase 2). E2E: `nota?: string` presente en create/update/read de Tarea.

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
- ✅ **Estado**: CORREGIDO (lote 6). Paso 6 del orquestador: llama `/api/crear-seed` y reporta su resultado en `results.seed`; el mensaje de éxito avisa "reinicie la api para sembrar". Contenido del seed: ver F9-M2.

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
| 1 | Nueva entity | ✅ CORREGIDA (lotes 1 y 3) |
| 2 | Editar entity | ✅ CORREGIDA (lote 4 — edición quirúrgica) |
| 3 | Crear nomenclador | ✅ CORREGIDA (lote 5 — nomenclador vivo) |
| 4 | Nuevo DTO | ✅ CORREGIDA (lote 2) |
| 5 | DTOs CRUD | ✅ CORREGIDA (lotes 2/3/5; quedan m1/m2 menores) |
| 6 | Crear mapper | ✅ CORREGIDA (lotes 3 y 4) |
| 7 | Crear repository | ✅ CORREGIDA (lotes 1 y 3) |
| 8 | Crear service | ✅ CORREGIDA (lote 1; queda M1 menor) |
| 9 | Crear controller | ✅ CORREGIDA (lotes 1 y 6; queda m1 menor) |
| 10 | CRUD completo | ⚠️ PARCIAL (quedan C1/C2/M1: tsc real, atomicidad, honestidad) |

**9/10 funciones corregidas y verificadas E2E; F10 parcial.** Pendiente: F10-C1/C2/M1 (verificación post-generación con tsc, atomicidad, honestidad del success), F8-M1, F9-m1; decisiones F5-M2/F3-m1.

## Decisiones pendientes del propietario

1. **F5-M2**: ¿adoptar sufijo `Id` en los campos de relación de DTOs (`menuId`) como la api, o mantener el nombre de propiedad?
2. **F3-m1**: ¿prefijo de tabla `nom_` para nomencladores o tabla sin prefijo?
3. **F1-M5/F2-M2**: ¿incluir relaciones dueñas (M:1/1:1) en el constructor de la entity como hace `menu-traduccion.entity.ts`? → *IMPLEMENTADO en fase 3 siguiendo el fix propuesto del registro (sí incluirlas, con orden requeridos-primero); el propietario puede pedir revertirlo.*

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

---

### Lote 2 (DTOs) — ✅ APLICADO Y VERIFICADO
- **Fixes**: F4-C1, F5-C1, F5-C2, F5-M1 + **F5-C3** (nuevo, hallado en E2E: atributos `T | null` se perdían en el parser).
- **Verificación E2E** (mismo banco: copia de api-base con Producto CRUD ya generado):
  - Entidades de prueba api-style: `EstadoEntity` (nomenclador, MOD_NOMENCLATOR) y `TareaEntity` (titulo + ManyToOne a Producto y Estado + nota nullable).
  - DTOs CRUD de Tarea regenerados: relaciones por id (`producto!: number`, `estado!: number`), IsNotEmpty importado/usado, update con opcionalidad del create, `nota` presente.
  - Modo `nuevo`: ComentarioDto emite @IsOptional importado para el campo opcional.
  - `tsc --noEmit`: **0 errores nuevos en `src/`**.
---

### Lote 3 (subsistema relacional: entity + mapper + repository) — ✅ APLICADO Y VERIFICADO
- **Fixes**: F1-C1..C5, F1-M1..M5, F1-m1, F6-C1, F6-C2, F6-C3, F6-M1, F6-m1, F7-C3, F7-M1 + **F5-C4** (nuevo, ver su sección).
- **Nueva infraestructura compartida**:
  - `utilities/entity-parser.ts` — parser robusto de entities (decoradores multi-línea, paréntesis anidados, strings con `)`, comentarios; garantía de progreso anti-bucle). Verificado contra las 13 entities reales de api-base: 13/13 OK.
  - `utilities/entity-edicion.ts` — edición quirúrgica de ficheros existentes (insertar miembro en clase, fusionar imports typeorm, escribir solo si cambia, nunca tocar lo que no parsea).
  - `ordenRequeridoPrimero` en entity-utils — orden de constructor compartido entre crear-entidad y crear-mapper (TS1016 y paridad posicional del `new XEntity(...)`).
- **Templates**: `entity.template.ts` (orderBy + `$typeormImport` + `$toStringBody` + `$index`), `mapper.template.ts` (simple síncrono / relacional con resolución i18n), `repository.template.ts` (simple / relacional con findXById). Los 4 templates de relación legacy (`many-to-one/one-to-many/one-to-one/many-to-many.template.ts`) quedaron SIN uso por las rutas vivas (solo los consume el código legacy de `lib/`, fuera de alcance).
- **Verificación E2E** (copia limpia de api-base + `bun install` + baseline `tsc --noEmit` = 24 errores preexistentes solo en `test/`):
  1. `TareaEntity` (titulo + descripcion nullable + vencimiento nullable + ManyToOne `prioridad` + ManyToMany `etiquetas`): crea además `PrioridadEntity` y `EtiquetaEntity` auto-creadas con inversas y registradas (avisos en la respuesta).
  2. `ComentarioEntity` (ManyToOne `tarea` → TareaEntity EXISTE): inyecta `@OneToMany(() => ComentarioEntity, (comentario) => comentario.tarea) comentarios!` con ancla en TareaEntity.
  3. DTOs CRUD + mapper + repository + service + controller de Tarea y Comentario: **13/13 pasos OK**.
  4. `tsc --noEmit`: **0 errores nuevos en `src/`** (24/24 preexistentes en test/).
  5. Registros dinámicos verificados: `TareaRepository`+`ComentarioRepository` en `export const repository`; `TareaMapper/Service`+`ComentarioMapper/Service` en `export const providers`; `TareaController`+`ComentarioController` en `export const controller`.
  6. Idempotencia: borrar Comentario y recrearla → TareaEntity conserva UN solo bloque `comentarios` (ancla).
  7. Colisión/OneToMany inversa: `NotaEntity` (OneToMany `tarea`) → inyecta `nota!: NotaEntity` con `nota_id` en TareaEntity (F1-C5) y `tsc` sigue limpio.
- **Código generado destacado** (paridad con api-base): `TareaMapper` con `findPrioridadById` + `NotFoundException(traducir('tarea.PRIORIDAD_NOT_FOUND', ...))`; `TareaRepository` con `@InjectRepository(PrioridadEntity)` + helper `activo: true`; `ReadTareaDto` con `prioridad?: number` y `etiquetas?: number[]`.
- **Hallazgos de la fase (corregidos en el mismo lote)**: bucle infinito del parser con decoradores indentados (`^\s*@` + garantía de progreso); placeholder `$attrNameRepository` sin sustituir; TS1016 (requerido tras opcional) resuelto con el orden compartido.
- **Pendiente siguiente**: F2 (editar entity = edición quirúrgica, hoy destructiva), F3 (repository concreto de nomenclador), F10 (validación post-generación), decisiones F5-M2/F3-m1.

---

### Lote 4 (editar-entity quirúrgico) — ✅ APLICADO Y VERIFICADO
- **Fixes**: F2-C1 (completa), F2-C2, F2-C3, F2-C4, F2-C5, F2-M1, F2-M2, F2-M3 + **F2-C6** y **F2-C7** (nuevos, ver sus secciones) + **F6-C4** (nuevo: orden posicional del mapper desde el constructor real).
- **Nueva infraestructura**:
  - `utilities/entidad-sync.ts` — motor de diff quirúrgico: diff por NOMBRE entre la lista deseada (UI) y los atributos reales; los existentes JAMÁS se re-emiten (el round-trip de la UI es lossy); adiciones con los generadores de fase 3 + cirugía de constructor (params por texto, una-línea y multi-línea; requeridos antes del primer opcional, TS1016; indentación heredada); eliminaciones por bloque (decoradores + propiedad, con límites anti-bucle y detección de decoradores de CLASE `@Entity/@Index/@Unique` — sin esto la eliminación se tragaba `export class`); verificación de referencias (`this.x` fuera del bloque) antes de eliminar; poda de imports typeorm/entidades sin uso.
  - `utilities/relacion-inversa.ts` — inyección/eliminación de inversas extraída de crear-entidad y compartida con actualizar-entidad; eliminación por ANCLA (`// [nestool] inversa de X.y`) con poda del import de la entity origen si queda sin uso.
  - `app/api/actualizar-entidad/route.ts` reescrito: 422 si el fichero no parsea (NUNCA se toca), 400 por duplicados, aviso si piden cambiar el schema (no se aplica), respuesta honesta (`agregados/eliminados/sinCambios/avisos/escrito`) en lugar de success ciego; escribe solo si el contenido cambió (idempotencia real).
  - `obtener-atributos-entidad` sobre el parser robusto compartido (F2-C6) + ruta kebab (F2-C7).
- **Verificación E2E** (copia limpia de api-base + `bun install`; baseline `tsc --noEmit` = 24 errores preexistentes solo en `test/`):
  1. **A/B**: crear `ProductoEntity` (3 columnas `!`) + carga → el editor ve las 3 (el parser legacy habría omitido todas las `!`).
  2. **C**: añadir `descripcion` nullable → bloque insertado, `constructor(..., descripcion?: string)` con asignación, imports fusionados sin duplicar, `@Entity`/`toString` intactos.
  3. **D**: añadir `categoria` ManyToOne requerida → lado dueño con callback a la inversa real + `@JoinColumn('categoria_id')`, param insertado ANTES del opcional (TS1016 OK), inversa anclada inyectada en `CategoriaEntity`, import kebab.
  4. **E**: reenviar la misma lista → `escrito: false`, md5 idéntico (idempotencia).
  5. **F**: `crear-mapper` de la entity editada → `new ProductoEntity(...)` coincide posición a posición con el constructor REAL (F6-C4).
  6. **G**: eliminar `descripcion` + `categoria` → bloques, params, asignaciones e imports retirados; inversa eliminada de Categoria por ancla; import ProductoEntity podado. **Bug hallado y corregido en la propia verificación**: el localizador arrancaba en `@Entity` y borraba `export class` — añadido corte en `export/class` + skip de decoradores de clase.
  7. **H**: round-trip de la NATIVA `MenuTraduccionEntity` (relaciones multi-línea, `@Index` compuesto, indentación 2) → **byte-idéntica**.
  8. **I**: fichero corrupto (clase sin cerrar) → `obtener` y `actualizar` responden 422 y el fichero queda intacto (también con lista vacía que "borraría todo").
  9. **J/K**: editar la nativa (añadir `nota`/`observacion`) y una entity nomencladora (`extends GenericNomencladorEntity`, `@Unique(['nombre'])`, schema `MOD_NOMENCLATOR`) → herencia, decoradores de clase y formato original intactos; asignación insertada hereda la indentación del cuerpo.
  10. **Cadena completa** sobre la entity editada (DTOs CRUD + mapper + repository + service + controller) → `tsc --noEmit` final: **0 errores nuevos en `src/`** (24/24 preexistentes).
- **Hallazgos de la fase (corregidos en el mismo lote)**: guard de constructor-en-una-línea capturaba el caso normal `constructor(...) {` con cuerpo multi-línea; `)` de cierre perdido al reconstruir params en línea; params no removidos por anclaje `^` en líneas (pasó a cirugía por TEXTO); asignaciones con indent fija 8 espacios (ahora heredada).
- **Pendiente siguiente**: F3 (repository concreto de nomenclador + MOD_NOMENCLATOR por defecto), F9-M1/M2 + F10-M2 (ListadoDto header==key, seed Funcion/endPoint contra el 403), F10-C1/C2/M1 (verificación post-generación con tsc, atomicidad), F8-M1, decisiones F5-M2/F3-m1.

---

### Lote 5 (crear-nomenclador vivo) — ✅ APLICADO Y VERIFICADO
- **Fixes**: F3-C1, F3-C2, F3-C3 + **F5-C5** y **F5-C6** (nuevos, ver sus secciones).
- **Historia**: este lote se completó una primera vez (commit local `4b258de`) pero el push falló por falta de credenciales y el reset del sandbox lo destruyó. Rehecho íntegramente desde la documentación del worklog (Task 19 → Task 20).
- **Hallazgo crítico del modelo real**: el mapa `repositories` de `GenericNomencladorRepository` es POR INSTANCIA y el único consultado en runtime es el de la instancia que `GenericNomencladorService` inyecta por token de clase → el concreto se registra en la instancia COMPARTIDA (OnModuleInit + acceso bracket al método protected). Documentado como refinamiento en F3-C1.
- **Cambios**:
  - `template/repository.template.ts`: nuevo `repositoryNomencladorTemplate` (repo concreto @Injectable implements OnModuleInit; CONTRATO: `$registro` == valor del NomencladorTypeEnum == `:name` del controller).
  - `app/api/crear-nomenclador/route.ts` reescrito en su tramo de wiring: eliminado el parche destructivo al genérico (F3-C1); genera repo concreto + alta en `repository/index.ts` (normalización de newline final) + import/array `export const repository` y `export const entity` de `persistence.service.ts` (patrón F7); schema default `MOD_NOMENCLATOR` uppercase (F3-C3, patrón F1-C6); pre-check 409 de entity Y repository ANTES de escribir nada; respuesta honesta con `registro` (qué quedó registrado y cómo) + `avisos`.
  - `app/api/crear-dto/route.ts`: `esNomenclador()` reconoce `extends GenericNomencladorEntity` (marcador estructural, independiente del schema); doble eliminarSufijo (F5-C5); read nomenclador solo herencia (F5-C6).
  - `app/api/listar-entidades/route.ts`: exclusión del dropdown reconoce el marcador estructural (3er punto de la cadena); ignore-list con las bases reales `GenericEntity`/`GenericNomencladorEntity`.
- **Verificación E2E** (dos copias limpias de api-base + `bun install`; baseline `tsc --noEmit` = 24 errores preexistentes solo en `test/`):
  - **A**: `EstadoCivil` → entity con `SchemaEnum.MOD_NOMENCLATOR` + tabla `nom_estado_civil`; repo concreto con registro en la instancia compartida; `repository/index.ts` y AMBOS arrays de `persistence.service.ts` actualizados; `ESTADOCIVIL = 'estadoCivil'` en el enum (contrato enum==registro==URL).
  - **B**: DTOs CRUD del nomenclador: 4 ficheros extendiendo los 4 `*NomencladorDto` de la api; read heredado limpio (`extends ReadNomencladorDto {}`).
  - **C**: 409 en duplicado de entity y de repository huérfano (pre-check de atomicidad).
  - **D**: cadena CRUD completa de `MarcaEntity` (con sufijo, camino riesgoso de F5-C5) vía `crear-crud-completo` + `crear-entidad`: 5/5 componentes OK, `create-marca.dto.ts` ↔ `CreateMarcaDto` ↔ import del controller consistentes.
  - **E**: `listar-entidades` con `excluirNomencladores` excluye `EstadoCivilEntity`; sin exclusión la lista; `GenericEntity`/`GenericNomencladorEntity` jamás listadas.
  - **F**: `tsc --noEmit` final en ambas copias: **0 errores nuevos en `src/`** (24/24 preexistentes). `tsc` de nestool-web: 0 errores.
- **Nota de operación**: si se editan templates con el dev server arriba, turbopack puede servir el template rancio → reiniciar el server (re-verificado en este lote).
- **Pendiente siguiente**: F9-M1 (ListadoDto header==key), F9-M2/F10-M2 (seed Funcion/endPoint → 403 del PermissionGuard), F10-C1/C2/M1 (validación post-generación, atomicidad, honestidad del success), F8-M1; decisiones del propietario F5-M2 (sufijo Id) y F3-m1 (nom_/orderBy).

---

### Lote 6 (listados honestos + permisos contra el 403) — ✅ APLICADO Y VERIFICADO
- **Fixes**: F9-M1, F9-M2, F10-M2.
- **Hallazgo del modelo real** (re-lectura de api-base `ca1da1e`): la cadena de autorización es `@Servicio(controller, servicio)` → PermissionGuard compara `controller.servicio` contra los endPoints de las Funciones de los roles. `parseController` (main.ts dev) SOLO sincroniza EndPoint de todos los controllers; NADIE crea Menu/Funcion para un CRUD genérico (`crearMenuAdministracion` fija a 5; `crearMenuNomenclador` solo enum) → sin seed, 403 para todos.
- **Cambios**:
  - `app/api/crear-controller/route.ts` (F9-M1): placeholder `$headerLabel` (labels capitalizados) separado de `$header` (claves crudas) en los 3 bloques ListadoDto; sustitución de `$headerLabel` SIEMPRE antes que `$header` (prefijo compartido). `template/controller.template.ts` sincronizado (doble copia documentada en F9-M1).
  - `app/api/crear-seed/route.ts` (NUEVA, F9-M2): genera `src/database/seed/crud-<kebab>.seed.ts` con `sembrarCrud<X>(app)` idempotente (menú por label → endPoints por controller → Funcion create-or-update con re-sync de endPoints → alta en ADMINISTRADOR por id de función) y engancha import + llamada en main.ts tras `parseController`. Pre-checks de atomicidad; recovery si main ya referenciaba el seed; 400 + rollback del import si falta el ancla.
  - `app/api/crear-crud-completo/route.ts` (F10-M2): paso 6 = `/api/crear-seed`, reportado en `results.seed`; mensaje de éxito avisa reiniciar la api para sembrar.
- **Verificación E2E** (copias limpias de api-base + `bun install`; baseline `tsc --noEmit` = 24 errores preexistentes solo en `test/`):
  - **A**: `crear-entidad Marca` (3 atributos) + `crear-crud-completo` → **6/6 pasos OK** (dto, mapper, repository, service, controller, seed).
  - **B** (F9-M1): controller generado con `header = ['id','Nombre','Descripcion','Activo']` vs `key = ['id','nombre','descripcion','activo']` en los 3 bloques (paridad con idioma.controller.ts). Hallazgo del propio E2E: el orden de sustitución generaba basura `…'activo'Label]` → corregido y re-verificado.
  - **C** (F9-M2): `main.ts` con import en línea 15 y `await sembrarCrudMarca(app);` inmediatamente tras `await parseController(endPointService);` (orden de siembra garantizado); seed file con el patrón espejo de crearMenuNomenclador.
  - **D**: `tsc --noEmit` final: **0 errores nuevos en `src/`** (24/24 preexistentes). `tsc` de nestool-web: 0 errores.
  - **E**: idempotencia — re-run de `crear-seed` → 409 "El seed crud-marca.seed.ts ya existe"; re-run del CRUD completo → parcial (dto true por regeneración idempotente del índice, resto 409/409-equivalentes); main.ts sin duplicar (1 import + 1 llamada tras 2 ejecuciones).
  - **F**: camino defensivo — main.ts sin ancla `parseController` → 400 con mensaje claro y main.ts intacto (import rehecho con rollback).
  - **G**: registros dinámicos íntegros (Marca presente en persistence.service.ts, core.service.ts, api.service.ts).
- **Nota**: el seed se ejecuta en el arranque dev de la api (misma política que el resto de la siembra de `sembrarDatosDesarrollo`); en producción la siembra sigue siendo manual por diseño de la api.
- **Pendiente siguiente**: F10-C1/C2/M1 (verificación post-generación con tsc real, atomicidad/cleanup, honestidad del success), F8-M1, F9-m1, F10-m1; decisiones del propietario F5-M2 (sufijo Id) y F3-m1 (nom_/orderBy).
