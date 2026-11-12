# 02 — Acceso y seguridad: autenticación, roles y auditoría

**Objetivo**: habilitar el acceso autenticado al sistema con el catálogo cerrado de roles y la traza de auditoría que exige RF-14. Es la dependencia de **todos** los endpoints de los cinco subsistemas.

**Rama**: `main`.
**Estrategia de entrega**: commits por work unit en `main` (repo sin remoto).
**Runner**: `pytest` (backend, `.venv`).

---

## Specs

### S1 — Gestión de cuentas y autenticación (RF-13)

> El sistema debe gestionar el registro, la modificación y la baja de cuentas de usuario, centralizando el proceso de autenticación en la plataforma.

Criterio: login por correo + contraseña, token JWT firmado, y baja lógica (`estado = inactivo`), nunca delete físico.

### S2 — Registro automático de auditoría (RF-14)

> El sistema debe registrar de manera automática y cronológica cada evento significativo o crítico, almacenando el usuario responsable, la fecha, la hora, la dirección IP y el cambio específico realizado.

Criterio: el servicio de auditoría crea `auditoria` + N `cambio_auditoria`, y es **append-only** (no expone update ni delete).

### S3 — Roles prefijados y cerrados (nivel 2 §6.2, nivel 3 §`usuario`/`rol`/`usuario_rol`/`profesional`)

> los roles son **prefijados y cerrados** (`Profesional`, `Profesor`, `Administrador`) y **acumulables** (un `Usuario` opera con uno o más). El usuario no modela roles propios ni modifica privilegios.

Criterio: `rol.codigo` ∈ {`bioquimico`, `profesor`, `administrador`}, sembrado por migración de datos, y un usuario acumula N roles vía `usuario_rol`.

### S4 — Seguridad de credenciales (manifiesto §1)

> Autenticación **JWT**: tokens firmados; contraseñas con hash (BCrypt/argon2)

Criterio: bcrypt con costo 12; nunca se persiste ni se loguea la contraseña en claro; el token expira según `ACCESS_TOKEN_EXPIRE_MINUTES`.

### S5 — Contraseñas y bloqueo por intentos

Bloqueo temporal tras `LOGIN_MAX_FAILED_ATTEMPTS` intentos fallidos, por `LOGIN_LOCK_MINUTES` minutos, usando `usuario.intentos_fallidos` y `usuario.bloqueado_hasta` (columnas del nivel 3).

### S6 — Fortaleza de contraseñas (supuesto declarado)

> Pedido del usuario, 2026-11-11: «Define tu propuesta de "fortaleza de contraseña" pero que el minimo sea 8 carácteres.»

El nivel 1 exige validar la fortaleza (UCE-SEG-02 paso 6, UCE-SEG-08 paso 7) sin definirla. Se adopta este criterio, aplicado en el alta y en el cambio de contraseña:

- **Mínimo 8 caracteres.**
- **Máximo 72 bytes.** `hash_password` trunca a 72 bytes (bcrypt): sin tope superior, dos contraseñas distintas después del byte 72 producen el mismo hash. El tope se valida en **bytes UTF-8**, no en caracteres.
- **Al menos una letra y al menos un dígito.**
- **No se exigen símbolos ni mayúsculas.** La longitud protege más que la composición (NIST SP 800-63B), y las reglas de composición empujan a patrones predecibles del tipo `Password1!`.
- Rechazo con `400` y mensaje en español que nombre la regla incumplida.
- La validación vive en el backend; el frontend muestra el mensaje pero no decide.

---

## Screens

Especificación derivada de los UCE del subsistema (nivel 1, §2.8.4), de los roles cerrados (nivel 2
§6.2) y de las tablas `usuario` / `rol` / `usuario_rol` / `profesional` / `auditoria` /
`cambio_auditoria` (nivel 3). No existe especificación previa de estas pantallas: cada
decisión de abajo cita su origen.

**Estado**: especificación corregida contra el código de T3. La aprobación anterior quedó
sin efecto (L19); T5 no arranca hasta la aprobación de esta versión (paso 4 de
`odd/design/screen-design-plan.md`).

**Cómo se revisa**: tres campos por pantalla y nada más.

1. **Respaldo** — ¿cita un UCE con paso? Si no, se rechaza.
2. **Reglas y excepciones** — ¿están todas las excepciones del UCE? Si falta una, es un
   agujero funcional.
3. **Acciones** — ¿cada acción tiene endpoint o está declarada fuera de alcance?

Layout, color y espaciado no se revisan: los resuelve el armazón existente
(`PageShell`, `Btn`, `Panel`, `EmptyState`).

---

### 1. Inventario derivado

Una pantalla por cada paso del UCE que nombra una pantalla. UCE-SEG-03 no nombra
ninguna y por eso no genera pantalla: es una acción del armazón.

| UCE (líneas) | Pasos | Pantalla | Patrón | Estado |
|---|---|---|---|---|
| UCE–SEG-01 Iniciar Sesión (L2342-2365) | 1-8 | **SEG-U01** Iniciar sesión | P3 | entregada (T1 de `03-shell-frontend.md`) |
| UCE–SEG-02 Administrar Usuario y Roles (L2367-2391) | 1-2 | **SEG-U02** Listado de usuarios | P1 | pendiente |
| UCE–SEG-02 (L2367-2391) | 3-6 | **SEG-U03** Alta y edición de usuario | P3 | pendiente |
| UCE–SEG-03 Cerrar Sesión (L2393-2411) | 1-4 | — ninguna pantalla: acción del armazón | — | entregada (S4 de `03-shell-frontend.md`) |
| UCE–SEG-04 Consultar Registro de Auditoría (L2413-2434) | 1-4 | **SEG-U04** Listado de auditoría | P1 | pendiente |
| UCE–SEG-04 (L2413-2434) | 5-6 | **SEG-U05** Detalle de evento de auditoría | P2 | pendiente |
| UCE–SEG-07 Recuperar Contraseña (L2436-2460) | 1-5 | **SEG-U06** Solicitar recuperación de contraseña | P3 | pendiente, **bloqueada** (§4 G2) |
| UCE–SEG-07 (L2436-2460) | 6-9 | **SEG-U07** Definir nueva contraseña desde el enlace | P3 | pendiente, **bloqueada** (§4 G2) |
| UCE–SEG-08 Cambiar Contraseña (L2462-2485) | 1 | **SEG-U08** Mi perfil | P2 | pendiente |
| UCE–SEG-08 (L2462-2485) | 2-8 | **SEG-U09** Cambiar contraseña | P3 | pendiente, **bloqueada** (§4 G2) |

**Reparto por patrón**: P1 ×2 (SEG-U02, SEG-U04), P2 ×2 (SEG-U05, SEG-U08), P3 ×5
(SEG-U01 entregada, SEG-U03, SEG-U06, SEG-U07, SEG-U09).

**Configuración por defecto de los listados** (contrato de respuesta de `AGENTS.md`):
`{items, total, limit, offset}`, `limit` 20 y tope 100, filtros nombrados como la
columna del nivel 3 y `q` para búsqueda libre. Es convención de repositorio, no
requisito: ya está registrada como supuesto en `AGENTS.md`.

---

### 2. Especificaciones

### SEG-U01 · Iniciar sesión

- **Patrón**: P3
- **Respaldo**: UCE–SEG-01 pasos 1-8 (L2342-2365); RF-13 (L253-257)
- **Actor y permiso**: público (sin sesión). Backend: ninguno
- **Ruta y entrada**: `/login`, único punto de entrada sin sesión
- **Estado**: **entregada**, `frontend/src/features/auth/LoginPage.tsx`. Se documenta
  para completar el inventario; **no se rediseña**.

**Datos**

| Campo | Origen |
|---|---|
| Correo Electrónico | `usuario.correo_electronico` |
| Contraseña | `usuario.contrasena_hash` (nunca se muestra) |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Ingresar | `POST /api/v1/auth/login` (form-urlencoded) | ambos campos con valor | guarda el token y redirige (paso 8) |
| ¿Olvidaste tu contraseña? | abre SEG-U06 | siempre | navegación |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Credenciales incorrectas (401) | `Credenciales inválidas` (paso 5, excepción) |
| Cuenta inactiva (403) | mensaje de cuenta inhabilitada (paso 4, excepción) |
| Cuenta bloqueada (423) | mensaje de bloqueo con los minutos restantes (ver D4) |
| Enviando | botón deshabilitado, sin doble submit |
| Error de red | mensaje de reintento, nunca "credenciales inválidas" |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Máximo `LOGIN_MAX_FAILED_ATTEMPTS` fallos, bloqueo por `LOGIN_LOCK_MINUTES` | R1 | S5 de `02-seguridad-acceso.md` (**D4**) | backend 423 |
| Error genérico, sin decir cuál dato falló | R1 | UCE–SEG-01 exc. paso 5 | backend 401 |
| El token vive en `sessionStorage`, nunca en disco | R4 | S3 de `03-shell-frontend.md` | UI |

**Fuera de alcance**: recuperación de contraseña (SEG-U06), registro público de cuentas.

---

### SEG-U02 · Listado de usuarios

- **Patrón**: P1
- **Respaldo**: UCE–SEG-02 pasos 1-2 (L2374-2375: «El Administrador ingresa al módulo
  de Seguridad», «El sistema lista los usuarios registrados»); RF-13
- **Actor y permiso**: `administrador`. Backend: `require_roles("administrador")`
- **Ruta y entrada**: Sidebar → Administración → Usuarios y Roles (`usuarios` ya existe
  en `navigation.ts` con `roles: []`, solo administrador)
- **Zonas**: header con breadcrumb `Administración / Usuarios y Roles` y acción primaria;
  barra de filtros; tabla; paginación

**Datos**

| Columna | Campo | Origen |
|---|---|---|
| Nombre y apellido | `nombre` + `apellido` | `usuario` |
| Correo | `correo_electronico` | `usuario` |
| Roles | `rol.nombre` vía `usuario_rol` | `rol` |
| Estado | `estado` (Activo / Inactivo) | `usuario` |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Nuevo usuario | `POST /api/v1/usuarios` | siempre | abre SEG-U03 en modo alta |
| Editar | — | siempre | abre SEG-U03 en modo edición |
| Desactivar | `PATCH /api/v1/usuarios/{id}` con `estado = inactivo` | `id != usuario_actual.id` (exc. paso 7) **y** `estado == activo` | baja lógica, auditada como `modificar` |

Sin acción de reactivar: ver §4 G4.

**Filtros**

| Filtro | Parámetro | Origen |
|---|---|---|
| Búsqueda libre por nombre, apellido o correo | `q` | convención del repositorio |
| Estado | `estado` = `activo` \| `inactivo` | `usuario.estado` |
| Rol | `rol` = `bioquimico` \| `profesor` \| `administrador` | `rol.codigo` |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Vacío | `Sin usuarios registrados` + acción Nuevo usuario |
| Sin coincidencias | `No se encontraron usuarios con esos filtros` + Limpiar filtros |
| Cargando | esqueleto de tabla, nunca números inventados |
| Error | `No se pudieron cargar los usuarios` + Reintentar |
| Sin permiso | redirección al inicio, no un 403 crudo |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Solo administrador accede | R2 | UCE–SEG-02 precondición (L2372); nivel 2 §6.2 | `require_roles` |
| El administrador no puede desactivar su propia cuenta | R1 | UCE–SEG-02 exc. paso 7 (L2386) | backend 400 + acción oculta |
| La baja es lógica, nunca delete físico | R1 | RF-13 + S1 | backend |
| Un usuario puede tener más de un rol | R4 | nivel 2 §6.2; S3 | UI muestra todos los roles, no el primero |

**Fuera de alcance**: crear, editar o borrar roles (catálogo cerrado, L2391). Editar
`profesional` (`matricula`, `especialidad`): ningún paso de UCE-SEG-02 lo pide.

---

### SEG-U03 · Alta y edición de usuario

- **Patrón**: P3
- **Respaldo**: UCE–SEG-02 pasos 3-6 (L2376-2379: «El sistema solicita los datos
  (nombre, apellido, correo electrónico, contraseña y rol)», «valida la unicidad del
  correo y la fortaleza de la contraseña»); S6 de `02-seguridad-acceso.md`
- **Actor y permiso**: `administrador`. Backend: `require_roles("administrador")`
- **Ruta y entrada**: desde SEG-U02 (Nuevo usuario / Editar). Sin entrada directa por
  URL: la pantalla no tiene identidad propia en el sidebar
- **Zonas**: header con breadcrumb y Cancelar; formulario en una columna; pie con
  Guardar / Cancelar

**Datos**

| Campo | Obligatorio | Origen | Validación |
|---|---|---|---|
| Nombre | sí | `usuario.nombre` | no vacío, ≤ 100 caracteres |
| Apellido | sí | `usuario.apellido` | no vacío, ≤ 100 caracteres |
| Correo electrónico | sí | `usuario.correo_electronico` | formato + único (400 con `campo`) |
| Contraseña | sí, solo en el alta | `usuario.contrasena_hash` | S6 |
| Roles | sí, 1 o más | `usuario_rol` → `rol.codigo` | debe existir en el catálogo cerrado |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Guardar (alta) | `POST /api/v1/usuarios` | formulario válido | crea usuario + roles + auditoría (paso 7) |
| Guardar (edición) | `PATCH /api/v1/usuarios/{id}` + `PUT /api/v1/usuarios/{id}/roles` | formulario válido | modifica + reemplaza roles + auditoría |
| Cancelar | — | siempre | vuelve a SEG-U02 descartando cambios |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Guardando | botón deshabilitado, sin doble submit |
| Error de campo (400) | mensaje en el campo, con `{"detail", "campo"}` |
| Error general | `No se pudo guardar el usuario` + Reintentar |
| Sin permiso | redirección al inicio |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Correo único | R3 | exc. paso 6 (L2384) | backend 400 con `campo` + mensaje en el campo |
| El rol debe existir en el catálogo cerrado | R3 | exc. paso 5 (L2385) | backend 400 + mensaje en campo |
| Fortaleza de contraseña | R3 | paso 6 + S6 | backend 400 + mensaje en campo |
| El administrador no puede desactivarse a sí mismo | R1 | exc. paso 7 (L2386) | backend 400 (la acción no vive en este formulario) |
| Todo alta/modificación deja traza | R1 | paso 7 (L2380); RF-14 | backend, servicio de auditoría |

**Fuera de alcance**: elegir `rol.codigo` fuera del catálogo (el selector lee el
catálogo, no lo escribe); editar `intentos_fallidos`, `bloqueado_hasta` ni
`fecha_registro` (los maneja el backend).

---

### SEG-U04 · Listado de auditoría

- **Patrón**: P1
- **Respaldo**: UCE–SEG-04 pasos 1-4 (L2420-2423: «El sistema consulta el registro de
  eventos», «El Administrador aplica filtros (usuario, fecha, tipo de acción)», «lista
  paginada»); RF-14 (L259-263)
- **Actor y permiso**: `administrador`. Backend: `require_roles("administrador")`
- **Ruta y entrada**: Sidebar → Administración → Auditoría (`auditoria` ya existe en
  `navigation.ts`, solo administrador)
- **Zonas**: header con breadcrumb; barra de filtros; tabla; paginación

**Datos**

| Columna | Campo | Origen |
|---|---|---|
| Fecha y hora | `fecha_hora` (formato `dd/MM/yyyy HH:mm`) | `auditoria` |
| Usuario | `nombre` + `apellido` vía `usuario_id` | `usuario` |
| Módulo | `modulo` | `auditoria` |
| Acción | `accion` | `auditoria` |
| Entidad afectada | `entidad_afectada` | `auditoria` |
| Dirección IP | `direccion_ip` | `auditoria` |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Ver detalle | `GET /api/v1/auditoria/{id}` *(T7)* | siempre | abre SEG-U05 |

No hay acciones de edición ni de borrado: el registro es **inmutable** (L2434; nivel 3,
`auditoria` append-only).

**Filtros**

| Filtro | Parámetro | Origen |
|---|---|---|
| Usuario | `usuario_id` (selector de usuarios) | paso 3 |
| Fecha desde / hasta | `fecha_desde`, `fecha_hasta` sobre `fecha_hora` | paso 3 |
| Tipo de acción | `accion` (ver D6) | paso 3 |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Vacío | `No hay eventos registrados` (excepción paso 2, L2428, textual) |
| Sin coincidencias | `No se encontraron eventos` (excepción paso 4, L2429, textual) |
| Cargando | esqueleto de tabla |
| Error | `No se pudo cargar el registro de auditoría` + Reintentar |
| Sin permiso | redirección al inicio |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Solo administrador accede | R2 | precondición (L2418); nivel 2 §6.2 | `require_roles` |
| Inmutable: no se edita ni se borra | R1 | L2434; nivel 3 | backend no expone update/delete |
| Orden cronológico descendente por defecto | R4 | UCE–SEG-04 paso 4 | UI |
| Consulta de solo lectura no se audita | R1 | RF-14 pide eventos «significativos o críticos» | servicio de auditoría |

**Fuera de alcance**: exportar el registro; rol no administrador.

---

### SEG-U05 · Detalle de evento de auditoría

- **Patrón**: P2
- **Respaldo**: UCE–SEG-04 pasos 5-6 (L2424-2425: «muestra el evento con usuario, fecha,
  acción y datos afectados»)
- **Actor y permiso**: `administrador`. Backend: `require_roles("administrador")`
- **Ruta y entrada**: desde SEG-U04, sobre una fila
- **Zonas**: header con breadcrumb y Volver; bloque de cabecera del evento; tabla de
  cambios de campos

**Datos**

| Bloque | Campo | Origen |
|---|---|---|
| Cabecera | `fecha_hora`, `usuario`, `modulo`, `accion`, `entidad_afectada`, `entidad_id`, `direccion_ip` | `auditoria` |
| Cambios | `campo`, `valor_anterior`, `valor_nuevo` (0..N filas) | `cambio_auditoria` |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Volver | — | siempre | vuelve a SEG-U04 conservando filtros |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Evento sin cambios de campo | «Evento sin cambios de campo registrados» (0..N es válido) |
| Evento inexistente | `No se encontró el evento` + Volver |
| Cargando | esqueleto |
| Sin permiso | redirección al inicio |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| `contrasena_hash` nunca se muestra | R1 | invariante de seguridad de `AGENTS.md`; RF-14 pide «el cambio específico», no secretos | backend devuelve el campo con valor oculto; UI lo rotula «Contraseña actualizada» |
| Valores vacíos se muestran como «—», no como celda en blanco | R4 | `valor_anterior` es nullable en la práctica (alta) | UI |
| Solo lectura absoluta | R1 | L2434 | sin acciones de escritura |

**Fuera de alcance**: reconstruir el registro afectado por `entidad_id` (relación
polimórfica sin FK, nivel 3 L583); enlaces a la entidad afectada.

---

### SEG-U06 · Solicitar recuperación de contraseña

- **Patrón**: P3
- **Respaldo**: UCE–SEG-07 pasos 1-5 (L2443-2447: «El usuario presiona "¿Olvidaste tu
  contraseña?"», «El sistema solicita el correo electrónico registrado»); RF-13
- **Actor y permiso**: público (sin sesión). Backend: ninguno
- **Ruta y entrada**: enlace desde SEG-U01
- **Zonas**: tarjeta centrada, formulario, enlace de vuelta al login

**Datos**

| Campo | Obligatorio | Origen | Validación |
|---|---|---|---|
| Correo electrónico | sí | `usuario.correo_electronico` | formato de correo |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Enviar enlace | `POST /api/v1/auth/recuperacion` *(T8, bloqueado por D5)* | correo con formato válido | siempre la misma respuesta; si existe, envía el correo (paso 5) |
| Volver al login | — | siempre | navegación |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Enviado | `Si el correo está registrado, te enviamos un enlace de recuperación` (excepción paso 4, L2454: mensaje genérico, no revela existencia) |
| Enviando | botón deshabilitado |
| Error de red | mensaje de reintento, sin revelar si el correo existe |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| La respuesta no revela si el correo está registrado | R1 | excepción paso 4 (L2454) | backend: mismo cuerpo y mismo status para ambos casos |
| El token de recuperación tiene TTL | R1 | paso 5 (L2447) | backend |
| Un correo mal formado se rechaza antes de enviar | R3 | derivado del paso 3 | backend 400 + campo |

**Bloqueante**: ver §4 G2. Sin decisión de almacenamiento y de envío de correo, esta
pantalla no se implementa.

---

### SEG-U07 · Definir nueva contraseña desde el enlace

- **Patrón**: P3
- **Respaldo**: UCE–SEG-07 pasos 6-9 (L2448-2451: «El usuario accede al enlace y define
  una nueva contraseña», «valida la fortaleza», «invalida el token de recuperación»);
  S6
- **Actor y permiso**: público con token de recuperación válido. Backend: valida el token
- **Ruta y entrada**: enlace recibido por correo, con el token en la URL
- **Zonas**: tarjeta centrada, formulario, aviso de expiración

**Datos**

| Campo | Obligatorio | Origen | Validación |
|---|---|---|---|
| Nueva contraseña | sí | `usuario.contrasena_hash` | S6 |
| Repetir nueva contraseña | sí | — | igual a la anterior (R4; no viaja al backend) |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Guardar contraseña | `POST /api/v1/auth/recuperacion/confirmar` *(T8, bloqueado por D5)* | formulario válido | actualiza hash, invalida el token (pasos 7-8) |
| Pedir un enlace nuevo | abre SEG-U06 | siempre | navegación |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Token inválido o expirado | `El enlace venció o no es válido` + Pedir un enlace nuevo |
| Contraseña débil | mensaje en campo con la regla incumplida (400 + `campo`) |
| Guardado | confirmación y redirección a SEG-U01 |
| Error de red | reintento, el token no se consume |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Fortaleza de la nueva contraseña | R3 | paso 7 (L2449) + S6 | backend 400 + campo |
| El token se invalida después de usarse | R1 | paso 8 (L2450) | backend |
| Un token usado no vuelve a servir | R1 | paso 8 | backend, con test propio |

**Bloqueante**: §4 G2.

---

### SEG-U08 · Mi perfil

- **Patrón**: P2
- **Respaldo**: UCE–SEG-08 paso 1 (L2469: «El usuario ingresa a su perfil y selecciona
  "Cambiar Contraseña"»)
- **Actor y permiso**: cualquier usuario con sesión activa. Backend: `get_current_user`
- **Ruta y entrada**: menú del usuario en el header (ver D3)
- **Zonas**: header con breadcrumb; bloque de datos de la cuenta; acciones

**Datos**

| Campo | Origen |
|---|---|
| Nombre y apellido | `usuario.nombre` + `usuario.apellido` |
| Correo | `usuario.correo_electronico` |
| Roles | `rol.nombre` vía `usuario_rol` |
| Estado | `usuario.estado` |

Fuente: `GET /api/v1/auth/me` (implementado, T2). No se incluye `fecha_registro`: el
endpoint no la expone y ninguna pantalla de SEG la pide.

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Cambiar contraseña | abre SEG-U09 | siempre | navegación |
| Cerrar sesión | — | siempre | descarta el token y vuelve a SEG-U01 (UCE–SEG-03) |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Cargando | esqueleto del bloque |
| Error | `No se pudieron cargar tus datos` + Reintentar |
| Sin permiso | no aplica: es la propia cuenta |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Solo muestra la cuenta propia | R2 | UCE–SEG-08 paso 1 | backend: `/me` deriva del token, no acepta `id` |
| El perfil no edita nombre, apellido, correo ni roles | R4 | ningún paso de UCE-SEG-08 lo pide; la modificación es de UCE-SEG-02 (administrador) | sin acciones de edición |
| Muestra todos los roles, no el primero | R4 | nivel 2 §6.2; S3 | UI |

**Fuera de alcance**: edición de datos propios (no hay UCE que la respalde).

---

### SEG-U09 · Cambiar contraseña

- **Patrón**: P3
- **Respaldo**: UCE–SEG-08 pasos 2-8 (L2470-2476: «solicita la contraseña actual y la
  nueva», «valida que la contraseña actual sea correcta», «valida la fortaleza»); S6
- **Actor y permiso**: cualquier usuario con sesión activa. Backend: `get_current_user`
- **Ruta y entrada**: desde SEG-U08
- **Zonas**: header con breadcrumb y Cancelar; formulario; pie con Guardar / Cancelar

**Datos**

| Campo | Obligatorio | Origen | Validación |
|---|---|---|---|
| Contraseña actual | sí | `usuario.contrasena_hash` | debe coincidir (exc. paso 4) |
| Nueva contraseña | sí | `usuario.contrasena_hash` | S6 |
| Repetir nueva contraseña | sí | — | igual a la anterior (R4) |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Guardar | `POST /api/v1/auth/password` *(T8)* | formulario válido | actualiza hash + auditoría (pasos 6-7) |
| Cancelar | — | siempre | vuelve a SEG-U08 descartando cambios |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Contraseña actual incorrecta | `La contraseña actual no es correcta`, en el campo (exc. paso 4) |
| Contraseña nueva débil | mensaje en campo con la regla incumplida (exc. paso 5) |
| Guardado | confirmación en pantalla (paso 8) |
| Error de red | reintento, sin perder lo escrito |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| La contraseña actual debe ser correcta | R1 | exc. paso 4 (L2479) | backend 400 + campo |
| Fortaleza de la nueva contraseña | R3 | exc. paso 5 (L2480) + S6 | backend 400 + campo |
| El cambio deja traza de auditoría | R1 | paso 7 (L2475); RF-14 | backend |
| La contraseña nunca viaja ni se registra en claro | R1 | S4; invariante de `AGENTS.md` | transporte HTTPS; auditoría sin valores |

**Fuera de alcance**: revocar sesiones abiertas en otros dispositivos (no hay
revocación: advisory 4 de `02-seguridad-acceso.md`).

---

### 3. Endpoints que estas pantallas necesitan

La columna «Dueño» es el hueco más importante de esta especificación: **cinco pantallas
dependían de endpoints que ninguna tarea cubría**. T7 y T8 ya los asignan; T8 sigue
bloqueada por D5 y por la dependencia SMTP.

| Endpoint | Usado por | Dueño | Estado |
|---|---|---|---|
| `POST /api/v1/auth/login` | SEG-U01 | T2 | implementado |
| `GET /api/v1/auth/me` | SEG-U08 | T2 | implementado |
| `GET /api/v1/usuarios` | SEG-U02 | T3 | implementado |
| `GET /api/v1/usuarios/{id}` | SEG-U02 | T3 | implementado |
| `POST /api/v1/usuarios` | SEG-U03 alta | T3 | implementado |
| `PATCH /api/v1/usuarios/{id}` | SEG-U03 edición | T3 | implementado |
| `PUT /api/v1/usuarios/{id}/roles` | SEG-U03 edición | T3 | implementado |
| `GET /api/v1/roles` | SEG-U03 selector | T3 | implementado |
| `GET /api/v1/auditoria` | SEG-U04 | T7 | pendiente |
| `GET /api/v1/auditoria/{id}` | SEG-U05 | T7 | pendiente |
| `POST /api/v1/auth/recuperacion` | SEG-U06 | T8 | bloqueado por D5 + SMTP |
| `POST /api/v1/auth/recuperacion/confirmar` | SEG-U07 | T8 | bloqueado por D5 + SMTP |
| `POST /api/v1/auth/password` | SEG-U09 | T8 | pendiente |

Las rutas de `usuario` ya están implementadas en T3 y verificadas contra el código real
(`backend/app/api/v1/usuarios.py`). Las de `auditoria` y de recuperación de contraseña
tienen tarea desde T7/T8: T5 no se implementa contra una ruta inventada. El contrato de
las rutas de usuario se fija en el código, no en esta especificación.

---

### 4. Decisiones abiertas y huecos

Cada punto bloquea algo concreto. Ninguno se resuelve por cuenta de esta especificación.

### D1 — Contraseña en la edición de usuario

El paso 4 de UCE–SEG-02 pide «contraseña» entre los datos, sin distinguir alta de
edición; la postcondición habla de datos «registrados, modificados o invalidados».

**Decisión de contrato (corregida contra el código real)**: el código de T3 no acepta
contraseña en `PATCH /api/v1/usuarios/{id}` (`UsuarioUpdate` no tiene `contrasena`), así
que la contraseña se define **solo en el alta** y se cambia desde SEG-U09 (cambio de
contraseña propia) o por el flujo de recuperación. El formulario de edición no muestra
ese campo.

- **Por qué**: un administrador que corrige un apellido no debe inventar una contraseña, y
  el código ya no la acepta. Si el dueño quiere que el administrador pueda fijarla, se
  agrega el campo a `UsuarioUpdate` en un work unit nuevo, no se cambia el contrato desde
  esta especificación.
- **Bloquea**: SEG-U03, campo Contraseña.
- **Alternativa descartada**: campo obligatorio en la edición, porque el código responde
  `422` si se envía un campo no declarado.

### D2 — Uno o varios roles en el formulario

El paso 5 de UCE–SEG-02 dice «selecciona **uno** de los roles prefijados» (singular).
El nivel 2 §6.2, S3 y `usuario_rol` (N:N) dicen **acumulables**.

- **Recomendación**: multi-selección, mínimo un rol. Es lo ya decidido en S3 y lo que la
  tabla `usuario_rol` permite; el singular del nivel 1 se lee como redacción, no como
  tope, y esa lectura ya está registrada.
- **Bloquea**: SEG-U03, campo Roles.
- **Si se decide lo contrario**: `usuario_rol` queda con una fila por usuario y se
  invalida S3 (habría que reescribirla y reabrir T2/T3).

### D3 — Entrada a «Mi perfil»

El paso 1 de UCE–SEG-08 exige un perfil, pero el modelo de navegación no tiene esa
página: hoy hay 10 páginas, todas módulos de negocio.

- **Recomendación**: menú del usuario en el header (nombre + desplegable con «Mi perfil»
  y «Cerrar sesión»). El sidebar sigue siendo el mapa de módulos; el perfil es de la
  persona, no del laboratorio.
- **Bloquea**: SEG-U08 y la ubicación de SEG-U09; toca `navigation.ts` y el gating de S5.
- **Alternativa**: página `perfil` en el sidebar, dentro de Administración (peor: todo
  usuario no administrador tendría una página en un grupo llamado Administración).

### D4 — Bloqueo por intentos fallidos: nivel 1 contra implementación

El nivel 1 dice que al quinto fallo la cuenta pasa a estado **«Inhabilitado»** y se
notifica en pantalla (UCE–SEG-01 exc. paso 5, L2360). La implementación vigente hace un
**bloqueo temporal** (`usuario.bloqueado_hasta`, `LOGIN_LOCK_MINUTES`, respuesta 423),
fijado en S5 y verificado en L5.

Son dos semánticas distintas: inhabilitar es permanente hasta que un administrador
reactive; bloquear es temporal y se libera solo. **El nivel 1 gana**, así que esto es una
divergencia de la implementación, no una decisión de pantalla.

- **Recomendación**: registrar S5 como desvío deliberado aprobado por el dueño (el
  bloqueo temporal protege igual y no deja cuentas muertas), y que la pantalla diga
  **«Cuenta bloqueada temporalmente. Reintentá en N minutos.»** Nunca «cuenta
  inhabilitada», porque no lo está.
- **Bloquea**: el texto del estado 423 de SEG-U01.
- **Si se sigue el nivel 1**: el mensaje cambia a «cuenta inhabilitada, contactá al
  administrador» y hay que reabrir S5 y el flujo de reactivación (G4).

### D5 — Almacenamiento y envío del token de recuperación

UCE–SEG-07 paso 5 exige un token con TTL enviado por correo. El nivel 3 **no tiene tabla
para eso**: `otp` existe pero cuelga de `analisis_id` (nivel 3 L178-187), es de otro
subsistema, y no se reutiliza.

- **Opción A (recomendada)**: token firmado sin estado (JWT con `purpose` de
  recuperación y TTL corto). No toca el esquema congelado, no requiere migración y la
  invalidación se resuelve con el `hash` vigente o un claim de versión.
- **Opción B**: tabla `recuperacion_password`. Es un cambio del nivel 3 y una migración:
  dueño integrante, no este carril.
- **Aparte**: el envío por correo es un **proveedor SMTP**, es decir una dependencia de
  runtime nueva, que `AGENTS.md` prohíbe sin aprobación explícita.
- **Bloquea**: SEG-U06, SEG-U07 y cualquier prueba de recuperación.

### D6 — Filtro «tipo de acción» de auditoría

`auditoria.accion` es `varchar` libre (nivel 3 L579, con ejemplos «crear / modificar /
eliminar / consultar»). Un filtro necesita un conjunto cerrado.

- **Recomendación**: el backend valida contra `{crear, modificar, eliminar, consultar}` y
  el selector muestra esos cuatro; si aparece un valor nuevo en la base, el filtro no lo
  ofrece y el listado sin filtro lo sigue mostrando.
- **Bloquea**: la barra de filtros de SEG-U04.

### G1 — Endpoints de auditoría (resuelto en T7)

`GET /api/v1/auditoria` y `GET /api/v1/auditoria/{id}` no existían y ninguna tarea los
cubría: T3 es CRUD de usuarios, T4 diseño, T5 frontend. **Resuelto**: T7 los asigna.
Sin T7, SEG-U04 y SEG-U05 no se implementan.

### G2 — Backend de contraseñas (resuelto en T8)

Igual que G1 para `POST /api/v1/auth/password`, `POST /api/v1/auth/recuperacion` y
`POST /api/v1/auth/recuperacion/confirmar`. **Resuelto**: T8 los asigna.
`POST /api/v1/auth/password` no tiene bloqueo; los dos de recuperación siguen sujetos a
D5 (token) y a la aprobación de la dependencia SMTP. **SEG-U09 también está bloqueada**
mientras T8 no exista: la pantalla es de una sola caja de texto, pero sin endpoint no hay
nada que probar.

### G3 — «Mi perfil» no está en el modelo de navegación

Ver D3. Toca `frontend/src/features/navigation/navigation.ts` y las pruebas de gating de
S5, que hoy fijan exactamente las 10 páginas actuales.

### G4 — No hay flujo de reactivación (requisito faltante)

UCE–SEG-02 define la baja lógica y **ningún paso define volver a activar** una cuenta.
`estado = inactivo` es, entonces, definitivo en la práctica. No se diseña un botón sin
regla: se reporta. Si el laboratorio necesita reactivar, se agrega el paso al UCE y
después la acción a SEG-U02.

### G5 — Datos de `profesional` sin pantalla en SEG

El nivel 3 define `profesional` (`matricula`, `especialidad`, 1:1 con `usuario`, solo rol
`bioquimico`), pero ningún paso de UCE–SEG-02 los pide al dar de alta un usuario. No se
inventa el campo. Queda reportado: o la carga de `matricula`/`especialidad` pertenece a
otro subsistema (agenda) o falta un paso.

### G6 — El registro de skills se reescribe por worktree

`git status` en este carril trae `.atl/skill-registry.md` modificado **antes** de este
trabajo: `gentle-ai skill-registry refresh` reescribió las rutas absolutas de los tres
skills de alcance proyecto (`C:\Users\...\sigemi\...` → `C:\work\sigemi-t4\...`) y el
título. Como cada worktree genera rutas distintas, el archivo cambia en cada carril y
produce conflicto por bytes que nadie editó. No se toca en este work unit; se reporta
para que el integrador decida (registro relativo al repo, o generado y no versionado).

---

### 5. Orden de implementación recomendado (paso 5-6 del plan)

Primero **una P1 y una P3**, que son las que definen el patrón que después se instancia
en el resto del sistema:

1. **SEG-U02** (P1) — obliga a construir `DataTable`, `FilterBar` y `Pagination`.
2. **SEG-U03** (P3) — obliga a construir `FormField`, el mapeo `400 + campo` → mensaje en
   campo, y el patrón de guardado.

Después, sin rediseñar: **SEG-U04** (P1, ya con la tabla), **SEG-U05** y **SEG-U08**
(P2), **SEG-U09** (P3). Al final **SEG-U06/07**, y solo después de resolver D5 y G2.

Hoy `frontend/src/components/` tiene `Btn`, `Panel`, `Kpi`, `EmptyState`, `PageShell` y
`Sidebar`: **no existe** tabla, barra de filtros, paginación ni campo de formulario. T5
construye esas cuatro primitivas en SEG-U02 y SEG-U03.

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Primitivas de seguridad (bcrypt, JWT), servicio de auditoría append-only, migración de datos del catálogo de roles, fixtures de test con rollback | S2, S3, S4 | delegated (2 en paralelo) | ✅ |
| T2 | API de autenticación: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `get_current_user`, `require_roles`, wiring del router | S1, S4, S5 | delegated | ✅ |
| T3 | CRUD de usuarios y asignación de roles (solo `administrador`), con auditoría de cada alta/baja/modificación | S1, S2, S3, S6 | inline | ✅ |
| T4 | Inventario y especificación de las pantallas de SEG (pasos 1-4 de `odd/design/screen-design-plan.md`). Aprobada por el dueño el 2026-11-12 (L21) | S1, S6 | — | ✅ |
| T5 | Implementación de las pantallas de SEG (patrones P1 y P3). SEG-U02 y SEG-U03 pueden arrancar; SEG-U04, U05, U06, U07 y U09 esperan T7/T8 | S1, S6 | — | ⏳ |
| T6 | Endurecer T3 según el review nativo: traducir la carrera de unicidad de correo y de reemplazo de roles a `400` con `campo`, y pinear `direccion_ip` en las filas de auditoría | S1, S2 | — | ⏳ |
| T7 | Backend de auditoría (G1): `GET /api/v1/auditoria` y `GET /api/v1/auditoria/{id}`, solo `administrador`, con filtros `usuario_id`, `fecha_desde`, `fecha_hasta` y `accion` | S2 | — | ⏳ |
| T8 | Backend de contraseñas (G2): `POST /api/v1/auth/password`; `POST /api/v1/auth/recuperacion` y `/confirmar` quedan sujetos a D5 (token) y a la aprobación de la dependencia SMTP | S1, S6 | — | ⏳ |

---

## Log

### L1 — Origen

Deriva de RF-13 y RF-14 (nivel 1), de los roles cerrados (nivel 2 §6.2) y de las tablas `usuario`/`rol`/`usuario_rol`/`profesional`/`auditoria`/`cambio_auditoria` (nivel 3).

### L2 — Evidencia de T1

- `pytest`: **299 passed**.
- `alembic upgrade head` → `8f5956edf3e4 -> c1bf7c1dd493, seed closed role catalog`.
- `select codigo from rol order by 1` → `administrador`, `bioquimico`, `profesor`.
- Fixtures: `db` abre una conexión y revierte la transacción al final de cada test (`join_transaction_mode="create_savepoint"`); `client` reemplaza la dependencia `get_db` por esa misma sesión, así los tests de API no ensucian la base de desarrollo.

### L3 — Corte de la sesión (2026-11-10)

El work unit quedó **partido a propósito**: T1 commiteado y verde, T2 no iniciado. Motivo: el modelo configurado para `gentle-ai-worker` (Claude Sonnet vía cliproxyapi) agotó su cuota (HTTP 429, reset en ~4h35m) y el subagente de T2 se canceló sin escribir archivos.

**Estado exacto al retomar**: HEAD = commit de T1; `git status` limpio; T2 arranca desde cero. El contrato de T2 ya está definido en el prompt de esa tarea (deps + router + tests) y las piezas que consume (`security.py`, `audit.py`, `roles_de_usuario`, `serializar_usuario`, `conftest.client`) ya existen y están testeadas.

### L4 — Evidencia de T2

- `pytest tests/test_auth.py`: **9 passed**. `pytest` completo: **308 passed** (299 + 9), sin regresiones.
- Rutas registradas: `/health`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/openapi.json`, `/docs`, `/redoc`.
- Decisión: el contrato de la firma de `login` era inválido en Python (`request: Request` no puede ir después de un parámetro con default). Se reordenó a `(request, form=Depends(), db=Depends(get_db))`; FastAPI inyecta `Request` por anotación, la semántica no cambia.
- Decisión: todas las respuestas 401 de login llevan `WWW-Authenticate: Bearer`, no solo las de `get_current_user`, para que el desafío OAuth2 sea consistente.
- Orden de reglas del login (fijado y testeado): desconocido → 401; inactivo → 403; bloqueado → 423; contraseña incorrecta → 401 + contador; correcta → token.

### L5 — Verificación independiente de T2

Verificador independiente sobre `2084dad`. **Sin bloqueantes.** S1, S2, S4 y S5 pass; S3 sigue vigente.

Probes observados: `pytest` 308 passed; token manipulado / firmado con otro secreto / expirado / `sub` no-UUID / usuario inexistente → 401; usuario inactivo → 403; `require_roles("administrador")` con rol `bioquimico` → 403 y con `administrador` → 200; `require_roles()` sin argumentos falla cerrado → 403; bloqueo persistente a través de requests separados, 423 con contraseña correcta estando bloqueado, y liberación al vencer; exactamente una fila de auditoría por login exitoso y una por bloqueo, **ninguna** por intento fallido suelto; ninguna respuesta expone `contrasena_hash` ni el token.

Se incorporaron los probes como `backend/tests/test_auth_security.py` (9 tests). `pytest`: **317 passed**.

**Advisories aceptadas / diferidas**:
1. **Enumeración por estado**: una cuenta inactiva responde 403 y un correo inexistente 401. Es consecuencia directa del contrato (S1 lo exige para dar un mensaje útil). Se acepta; si el cliente prioriza no revelar existencia de cuentas, se unifica a 401 y se mueve la explicación al correo de contacto.
2. **Enumeración por tiempo**: con correo inexistente no se ejecuta bcrypt (~150 ms de diferencia). Diferido: mitigar con un hash dummy constante si se decide cerrar el canal.
3. **`direccion_ip` detrás de proxy inverso**: `request.client.host` devuelve la IP del proxy si el despliegue va detrás de Nginx/Traefik. **RF-14 exige la IP real**, así que esto debe resolverse en el work unit de despliegue (`uvicorn --proxy-headers --forwarded-allow-ips=<proxy>` o middleware de proxy confiable). No es un defecto del endpoint, es configuración de entorno.
4. **JWT sin `jti` ni revocación**: `get_current_user` revalida estado y roles contra la base en cada request, así que desactivar un usuario surte efecto inmediato. La revocación de un token individual queda para cuando exista un logout real.

### L6 — Supuesto de política de contraseñas (2026-11-11)

Nivel 1 exige "validar la fortaleza de la contraseña" en UCE-SEG-02 (paso 6, línea 2379) y UCE-SEG-08 (paso 7, línea 2449) sin definir qué significa. Consultados los tres niveles, ninguno fija un mínimo, un máximo ni reglas de composición.

Se registra **S6** como supuesto explícito, decidido por el usuario, para que T3 tenga contra qué testear. El mínimo de 8 caracteres lo fijó el usuario; la exigencia de letra y dígito, y el tope de 72 bytes, se derivan de la implementación vigente (`hash_password` trunca a 72 bytes) y de NIST SP 800-63B.

**Consecuencia sobre T3**: la especificación de la tarea pasa de `S1, S2, S3` a `S1, S2, S3, S6`. Si el cliente pide otra política, se reescribe S6 y se reabre solo T3.

### L7 — Corrección de estado de las pantallas (2026-11-11)

**Se revirtió** la decisión de tratar `OPENCODE-ARTIFACTS/Pantallas/` como autoridad de presentación. El dueño del repositorio la declaró **obsoleta**: no contiene diseños válidos de pantallas no entregadas. `AGENTS.md` ahora la excluye explícitamente como fuente de diseño, inventario o reglas.

**Estado real**: no existe ninguna especificación de pantalla para las pantallas no entregadas. No hay inventario. No hay prototipo utilizable más allá del armazón ya implementado (S6/S7 de `03-shell-frontend.md`) y la única pieza del archivo Figma (`X7mBlw5ZzuvAIyZXb1UVdG`, nodo `1:3`), que es una copia generada desde el código.

**Procedimiento adoptado**: `odd/design/screen-design-plan.md`. Se agregaron **T4** (inventario + especificación) y **T5** (implementación), ambas pendientes y sin ruta asignada.

**Dependencias**: T3 es backend y no depende de T4. T5 sí depende de T4 aprobada. El orden recomendado es T3 → T4 → T5.

### L8 — Base de instrucciones y reparto en carriles (2026-11-11)

**Corte**: `0050940` — `docs: pin the agent instruction base and parallel execution policy`. Antes de este commit, `AGENTS.md`, `odd/design/screen-design-plan.md`, `.atl/skill-registry.md` y `skills-lock.json` estaban **sin trackear**, y este documento no tenía S6, T4, T5, L6 ni L7. Un `git worktree add` materializa `HEAD`, no el working tree: cualquier worktree creado antes de este commit nacía sin las reglas del repositorio. Ese era el bloqueante real para trabajar en paralelo, no git.

**Política adoptada**: `AGENTS.md`, sección `## Parallel execution (git worktrees)`. Fija las cuatro precondiciones de un carril, el stack único de infraestructura, una base de datos por carril, el dueño único de cada recurso compartido y las reglas de corrida larga.

**Reparto**:

| Carril | Tarea | Escribe | No toca |
|---|---|---|---|
| Backend (`feat/seg-t3-usuarios`) | T3 | `backend/app/api/v1/usuarios.py`, `app/schemas/`, `app/services/`, `app/cli/`, `backend/tests/test_usuarios*.py`, `## Tasks` fila T3 y `## Log` de este documento | `frontend/`, `alembic/versions/`, `## Screens` |
| Pantallas (`feat/seg-t4-inventario`) | T4 | `odd/design/seg-screens-draft.md` | Todo lo demás (lectura permitida) |
| Integrador (`main`) | merge y cierre | `## Screens` final tras revisión humana, `alembic/versions/`, suite completa | — |

T5 queda bloqueada hasta que T4 esté aprobada, y entonces escribe solo `frontend/src/**`.

T3 **no requiere migración**: las tablas de `usuario`/`rol`/`usuario_rol`/`auditoria` existen desde `8f5956edf3e4` y el catálogo se sembró en `c1bf7c1dd493`. Por eso el carril backend cumple las cuatro precondiciones sin pedirle nada al integrador.

**Precondiciones no satisfechas al momento del corte**:

1. Docker Desktop estaba apagado (`docker ps` no conecta al named pipe). El stack se levanta una sola vez desde este árbol antes de correr pruebas.
2. `.agents/` sigue en `.gitignore`, así que los cuatro skills de alcance proyecto (`impeccable`, `vercel-composition-patterns`, `vercel-react-best-practices`, `web-design-guidelines`) **no existen** en un worktree. Los 18 skills de alcance usuario sí, porque viven en el perfil. Afecta solo a T5.
3. `impeccable` está instalado en `.agents/skills` pero **no figura en `skills-lock.json`**, contra la regla de `AGENTS.md` §Skills: fijar la fuente en el repositorio. Pendiente de decisión del dueño.

### L9 — Evidencia del arranque de carriles (2026-11-11)

**Infraestructura**: Docker Desktop estaba apagado y se encendió. `docker compose up -d db redis` se corrió **una sola vez desde el árbol principal**. `sigemi-db` healthy en `5433`, `sigemi-redis` healthy en `6380`. La base de desarrollo `sigemi` quedó intacta: `alembic_version = c1bf7c1dd493`, 3 roles, 0 usuarios.

**Worktrees**: `C:\work\sigemi-t3` en `feat/seg-t3-usuarios` y `C:\work\sigemi-t4` en `feat/seg-t4-inventario`, ambos sobre `5d78048`. El carril de pantallas no necesita bootstrap; el backend tiene su `.venv` propio con `requirements-dev.txt` instalado. `backend/.venv` y `frontend/node_modules` **no** se copiaron entre worktrees.

**Base por carril**: `sigemi_t3` creada sobre el servidor compartido. `alembic upgrade head` ejecutado desde el worktree del carril → `c1bf7c1dd493` + 3 roles. La base de desarrollo `sigemi` no recibió ningún cambio.

**Respaldo**: `C:\work\sigemi-2026-11-11.bundle` (`git bundle create --all`), verificado con `git bundle verify` → «records a complete history».

**Evidencia del carril backend**: `pytest` desde `C:\work\sigemi-t3\backend` con `DATABASE_URL` apuntando a `sigemi_t3` → **320 tests, 0 failures, 0 errors, 0 skipped, 48.33 s** (junit). El aislamiento funciona: al terminar, `sigemi_t3` quedó con 0 usuarios, porque el fixture revierte cada transacción.

**Corrección de baseline**: L5 registró **317**. El conteo real es **320**. El criterio de T3 pasa a «≥ 320 sobre la base actual», no «≥ 317».

**Hallazgo — probe flaky preexistente**. `tests/test_auth_security.py::test_tampered_token_is_rejected` (commit `ef51e70`) altera el último carácter del token:

```python
tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
```

La firma HS256 son 32 bytes → 43 caracteres base64url. El último carácter solo aporta **4 bits significativos**: reemplazarlo por `A` deja los bytes decodificados **idénticos** en aproximadamente 1 de cada 16 casos (medido sobre 300 tokens: **19 coincidencias**). Cuando coincide, el token sigue siendo válido, `/api/v1/auth/me` responde `200` y el test falla.

No es un defecto de seguridad: es un defecto del probe. Consecuencia operativa: la suite falla ~6 % de las corridas sin que nada esté roto, y el carril de T3 la va a correr muchas veces. **Acción**: corregir el probe alterando un byte de la firma de forma determinista, en un commit de test propio antes o junto con T3.

### L10 — Endurecimiento de la base (2026-11-12)

**Pedido del usuario, textual**: «Si, confio. Además quiero que los comentarios de los commits se hagam en español.»

Eso **contradice** el contrato de idioma previo de `AGENTS.md` («commit messages stay English»). Se resolvió a favor del dueño y se dejó escrito, no aplicado en silencio: `AGENTS.md` §Language contract ahora exige descripción en español, con el tipo y el scope del Conventional Commit en inglés por ser tokens estructurales. Los commits anteriores a 2026-11-12 quedan en inglés y **no se reescribe historia**.

**Aprobado en el mismo pedido**: normalización de finales de línea, linters como gate, y fijar las dos formas que T3 está por inventar.

**1. `.gitattributes`** (commit `8f62f3e`): `* text=auto eol=lf`, scripts de Windows en CRLF, binarios marcados. El índice y el working tree ya estaban en LF, así que `git add --renormalize .` fue **no-op**: el atributo previene la deriva futura sin tocar un solo blob. Antes de esto, cada `git add` avisaba «LF will be replaced by CRLF», y con dos carriles eso es diff de archivo completo y conflicto por bytes que nadie editó.

**2. Ruff como gate del backend** (commit `042bde2`): configuración en `backend/pyproject.toml` con `select = [E4, E7, E9, F, I, B, UP]`, `B008` ignorado (FastAPI expresa la inyección de dependencias como llamada en un argumento por diseño) y `alembic/versions` excluido, porque el formateador quería reescribir una migración **ya aplicada** y eso viola el contrato de esquema congelado. 29 hallazgos iniciales → 16 corregidos y 15 archivos reformateados. `ruff==0.17.4` fijado en `requirements-dev.txt`.

**3. ESLint como gate del frontend** (commit `febe264`): flat config con `typescript-eslint`, `js.configs.recommended` y `react-hooks`. Un solo hallazgo en todo el árbol (`_init` sin usar en `test/fixtures.ts`), resuelto en la configuración con `argsIgnorePattern: '^_'`, no tocando el fixture. Script `npm run lint`.

**Contrato de respuesta fijado** en `AGENTS.md` §Response contract: `{"detail": "<mensaje>"}` en todo 4xx/5xx; `{"detail", "campo"}` con `400` para validación por campo (regla R3); el `422` automático de FastAPI no es contrato de usuario; los listados devuelven `{items, total, limit, offset}`, con filtros nombrados como la columna del nivel 3 y `q` para búsqueda libre.

**Supuesto declarado**: `limit` por defecto 20 y tope 100. No viene del nivel 1: es convención de repositorio, decidida dentro de este pedido, y vive en un solo lugar para poder revisarla sin reabrir tareas.

**Evidencia observada**: backend `ruff check` limpio y `ruff format --check` con 41 archivos OK; `pytest` **320 passed** (junit, 31.5 s). Frontend `eslint` limpio, `tsc --noEmit` exit 0, `vitest` **24 passed**, `build` OK.

**Hallazgo operativo**: el primer `pytest` posterior a ruff falló con `psycopg.OperationalError: ... Socket is not connected`. No era el cambio: Docker Desktop se había apagado al dormir la máquina (la fecha cambió a 2026-11-12). Levantado el stack, ambas bases persistieron (`sigemi` y `sigemi_t3`) y la suite volvió a 320. `AGENTS.md` §Long unattended runs ahora lo fija: un error de conexión es infraestructura, no regresión, y no se concluye nada hasta que la base responda.

### L11 — Skills de alcance proyecto: qué se fija y qué no (2026-11-12)

**Pregunta del dueño**: «lo necesita? si es así hazlo.»

**Respuesta**: T5 necesita **tres** de los cuatro; `impeccable` no.

**Por qué los tres**: T5 no construye dos pantallas, construye **el patrón que después se instancia en unas treinta**. `web-design-guidelines` aporta lo que una tabla con filtros y un formulario de alta necesitan sí o sí: etiquetas asociadas, foco, navegación por teclado, semántica de formulario. `vercel-composition-patterns` ataca exactamente el problema de un `DataTable`/`FormField` reusado: composición por compound components en vez de proliferación de props. `vercel-react-best-practices` es el que menos aporta —la mitad de sus reglas son de Next.js y este proyecto es una SPA de Vite— pero está fijado por `skills-lock.json` y sus reglas de React sí aplican.

**Por qué `impeccable` no**: son 2.24 MB de los 2.5 totales, 63 archivos y **5 scripts** (`live-browser.js`, `live-browser-session.js`, `live-browser-dom.js`, `live-browser-ignores.js`, `modern-screenshot.umd.js`): un arnés de captura de browser, no documentación. `AGENTS.md` §Skills obliga a rechazar todo skill que pida red, credenciales o escrituras fuera del repositorio sin aprobación explícita. Además no hace falta para implementar pantallas: es un flujo de captura y auditoría de diseño. Sigue disponible en el árbol principal, fuera del repo.

**Coherencia con lo ya decidido**: el argumento que usamos para fijar `pyproject.toml` y `eslint.config.js` —que el resultado no dependa de configuración ambiente de la máquina— vale igual para los skills. Un skill fuera de `HEAD` es una dependencia ambiente. Los tres que se fijan coinciden **exactamente** con los que `skills-lock.json` ya declaraba, así que queda cumplida la regla de fijar la fuente en el repositorio; `impeccable` era el único instalado por fuera del lock, y ahora se documenta su exclusión en vez de dejarla implícita.

**Consecuencia**: `.gitignore` ya no ignora `.agents/` entero, solo `/.agents/skills/impeccable/`. Cualquier worktree creado desde este commit trae los tres skills y el carril de T5 es autosuficiente.

**Defecto conocido del registry**: `vercel-composition-patterns` figura indexado con descripción vacía («—») porque su `SKILL.md` usa un `description:` en escalar plegado que el generador no parsea. No afecta al uso —la ruta está indexada y se pasa explícita— pero el skill no se va a seleccionar por descripción.

### L12 — Probe de firma alterada, corregido antes de T3 (2026-11-12)

**Defecto**: el probe de L9 seguía vivo en `154bf0f`. Reproducido al verificar la base antes de largar el carril de T3: `pytest` desde `C:\work\sigemi-t3\backend` devolvió **1 failed, 319 passed**, con el fallo en `tests/test_auth_security.py::test_tampered_token_is_rejected`. Es el mismo defecto ya descrito: el último carácter base64url solo aporta 4 bits significativos, así que reemplazarlo deja la firma idéntica en aproximadamente 1 de cada 16 tokens.

**Segunda ocurrencia**: el mismo patrón estaba en `tests/test_security.py::TestDecodeErrors::test_tampered_signature_raises`. Nunca se lo observó fallar por baja frecuencia de corrida, pero el defecto es idéntico. Corregir solo uno habría dejado el otro latente.

**Corrección**: módulo nuevo `backend/tests/jwt_probe.py` con `tamper_signature(token)`, que decodifica el segmento de firma, invierte el bit bajo del primer byte y lo re-codifica en base64url sin padding. Es determinista: los bytes que PyJWT verifica cambian siempre. Los dos probes lo usan y afirman además que el encabezado y el payload quedaron intactos y que la longitud de la firma se conservó, para que un 401 no pueda venir de un token mal formado en vez de una firma alterada.

**Evidencia observada**: 500 tokens generados, `tamper_signature` aplicado a cada uno → **0 firmas idénticas**, encabezado y payload preservados en los 500. Los dos probes dirigidos: `2 passed`. Suite completa desde `backend/`: **320 passed, 1 warning, 20.29 s**. `ruff check .` exit 0 y `ruff format --check .` → 42 archivos ya formateados.

**Consecuencia sobre T3**: el criterio «≥ 320 en verde sobre la base actual» vuelve a ser observable. La base de los dos carriles pasa a este commit.

### L13 — Evidencia de T3 (2026-11-12)

**Superficie implementada** (`/api/v1`, todas las rutas exigen rol `administrador`):

| Método | Ruta | UCE-SEG-02 |
|---|---|---|
| `GET` | `/usuarios` | paso 2 (listado), con `q`, `correo_electronico`, `estado`, `rol`, `limit`, `offset` |
| `GET` | `/usuarios/{id}` | selección de un usuario existente |
| `POST` | `/usuarios` | pasos 4-7 (alta) |
| `PATCH` | `/usuarios/{id}` | modificación y baja lógica (`estado = inactivo`) |
| `PUT` | `/usuarios/{id}/roles` | paso 5 (asignación de roles) |
| `GET` | `/roles` | paso 5: catálogo cerrado que alimenta el selector |

**Decisiones de contrato** (fijadas acá porque el nivel 1 no las cubre y las heredan los otros cuatro subsistemas):

1. **Toda validación de campo responde `400` con `{"detail", "campo"}`**, incluida la unicidad del correo. El paso 6 de UCE-SEG-02 agrupa «unicidad del correo» y «fortaleza de la contraseña» como la misma validación, así que ambas usan la misma forma y el formulario puede ubicar el mensaje sin casos especiales. No se usa `409`: el contrato de `AGENTS.md` §Response contract ya nombra el `400` con `campo` como la respuesta de validación por campo, y dos formas para el mismo grupo de reglas obliga a la SPA a distinguirlas.
2. **La baja es `PATCH` con `estado = inactivo`**, no un `DELETE`: S1 prohíbe el borrado físico y `DELETE /usuarios/{id}` responde `405` (test `test_delete_is_not_exposed`).
3. **La baja lógica se audita como `modificar`**, no como `eliminar`: la fila no se borra, y la auditoría debe decir lo que pasó. El cambio queda como `("estado", "activo", "inactivo")`.
4. **`PUT /usuarios/{id}/roles` reemplaza el conjunto completo** (idempotente). Un `PATCH` parcial obligaría a inventar una semántica de merge que ningún requisito pide.
5. **`limit` se recorta a 100, no se rechaza**: el contrato dice «capped at 100» y el cuerpo devuelve el `limit` efectivo, así el cliente se entera del recorte.
6. **Un `PATCH` sin campos responde `400`** (`"No se enviaron campos para modificar"`) en vez de escribir una auditoría vacía.
7. **El texto se normaliza** en `nombre`, `apellido` y `correo_electronico` (trim; el correo además a minúsculas). Un valor en blanco responde `400` con `campo`. Por eso los schemas solo llevan cotas **superiores**: un `min_length` habría convertido el blanco en el `422` automático en vez del `400` con mensaje. Ver la corrección en L14.
8. **El único autobloqueo prohibido es el que nombra el requisito**: desactivar la propia cuenta (paso 7, excepción). Quitarse el rol `administrador` a uno mismo **no** está prohibido por el nivel 1 y no se inventó la regla; queda registrado como hueco a decidir por el dueño.
9. **Fortaleza de contraseña** (S6) en `app/services/usuarios.py::validar_contrasena`, con orden fijo: mínimo 8 caracteres, techo de 72 **bytes UTF-8**, al menos una letra, al menos un dígito. Los límites de longitud salieron del schema de Pydantic (`UsuarioCreate.contrasena`), porque un `max_length` habría producido el `422` automático en vez del `400` con mensaje que exige S6.

**Auditoría** (RF-14): un alta escribe una fila `crear` con cambios `correo_electronico`, `estado` y `roles`; una modificación escribe una fila `modificar` con un `cambio_auditoria` por campo realmente cambiado (valor anterior y nuevo); un reemplazo de roles escribe `("roles", "anterior", "nuevo")`. La contraseña nunca se escribe en auditoría ni se devuelve en ninguna respuesta (aserción explícita en el test del alta).

**Archivos escritos, incluidos tres fuera de la tabla del carril y por qué**:

- `backend/app/api/v1/router.py` — sin el wiring no hay ruta; dos líneas.
- `backend/app/api/deps.py` — `client_ip(request)` pasa a `deps.py` para no duplicar el helper en cada módulo que escribe auditoría. `app/api/v1/auth.py` lo consume ahora desde ahí: **el comportamiento es idéntico**, y los tres módulos de tests de auth lo siguen probando en verde.
- `backend/app/schemas/access.py` — `UsuarioList`, `RolList` y la relajación de los límites de contraseña explicada en el punto 9.

**Prueba de comportamiento previo**: `serializar_usuario` cambió por dentro (ahora delega en `serializar_usuarios`, que resuelve los roles de toda la página en una consulta). Diferencial contra la implementación del commit base, ejecutado desde `backend/` con la base y el catálogo reales, para 0, 1 y 3 roles: `viejo == nuevo == lote` en los tres casos, `0` diferencias. El probe es ad-hoc y **no** se commitea; `/auth/me` ya está pinneado por `tests/test_auth.py` y `tests/test_auth_contract.py`.

**Evidencia observada**:

- RED previo: la suite del archivo nuevo falló completa (exit 1) antes de escribir la implementación.
- `pytest tests/test_usuarios.py -o addopts=` → **30 passed, 1 warning in 40.28s**.
- `pytest -o addopts=` completo desde `backend/` con `DATABASE_URL` apuntando a `sigemi_t3` → **350 passed, 1 warning in 61.31s**, exit 0.
- `ruff check .` → `All checks passed!`; `ruff format --check .` → `46 files already formatted`.
- Criterio de L12 cumplido: ≥ 320 sobre la base actual, con 30 tests nuevos que lo elevan a 350.

**Nota de operación**: `backend/pytest.ini` fija `addopts = -q`. Un `-q` adicional en la línea de comando compone `-qq` y **borra la línea de resumen**, así que el conteo de passed hay que leerlo de los puntos o con `-o addopts=`. No es un defecto de la suite, pero explica por qué una corrida verde no muestra «N passed».

**Anomalía preexistente, no tocada**: `.atl/skill-registry.md` estaba modificado al abrir el carril. Es la regeneración local del registry, que reescribe las rutas absolutas del árbol principal a `C:\work\sigemi-t3` y elimina la fila de `impeccable` que L11 documenta como excluida a propósito. No se commitea: es estado del carril, no del repositorio.

### L14 — Verificación independiente de T3 y corrección (2026-11-12)

Verificador independiente sobre `c2bd43f`. Veredicto: **un bloqueante**; S2, S3 y S6 pass; S1 fail por el bloqueante. Invariantes de autorización, baja lógica, autodesactivación, auditoría, listado, roles y no-regresión de `/auth` pasaron.

**Bloqueante B1 — correo en blanco aceptado**. `correo_electronico = "   "` (3 espacios) pasaba el `min_length=3` de Pydantic y, tras el `strip`, se persistía como cadena vacía: `POST /usuarios` respondía `201` y `PATCH` respondía `200`. Reproducido con dos probes, `201 == 400` y `200 == 400` fallando.

No era un detalle cosmético: **contradecía la decisión 7 de L13** («un valor en blanco responde `400` con `campo`»), que el código no cumplía para el correo. Lo detectó un verificador leyendo el log contra el código, que es exactamente su trabajo; mis 30 tests no lo cubrían porque probaban el contrato que yo había escrito, no el que yo había documentado.

**Corrección** (una sola pasada, más los probes del verificador como tests):

- `correo_electronico` pasa por `normalizar_texto` en el alta y en la modificación, igual que `nombre` y `apellido`, y recién después se pasa a minúsculas.
- `UsuarioCreate` y `UsuarioUpdate` conservan solo cotas superiores: un `min_length` en cualquier campo de texto libre habría devuelto `422` en vez del `400` con `campo`. Vale también para el advisory 1 del verificador (1-2 espacios daban `422`).
- Cuatro tests de regresión nuevos: blancos en el alta, blancos en la modificación, `validate-before-apply` (un payload rechazado por `estado` no aplica el `nombre` que lo acompañaba) y comodines de `LIKE` escapados en `q` (`_` y `%` matchean literal).

**Advisory aceptado, sin cambio**: quitarse el rol `administrador` a uno mismo sigue sin bloquearse. El nivel 1 no lo prohíbe y no se inventa la regla; queda como hueco declarado en la decisión 8 de L13 para que lo decida el dueño.

**Evidencia observada**: `pytest tests/test_usuarios.py` → **34 passed** (30 + 4) en 42,59 s; `pytest` completo → **354 passed**, 1 warning, 62,29 s; `ruff check .` → `All checks passed!`; `ruff format --check .` → `46 files already formatted`. El verificador confirmó, además, que no quedó ningún archivo de probe en el worktree.

### L15 — Review nativo de T3: aprobado (2026-11-12)

**Candidato**: `4980322..8f90fae`, `base_tree` `bb3efbf`, `candidate_tree` `78fab9a`, 10 archivos, 1421 líneas. Linaje `review-6a83da50eeaf78aa`.

**Tier**: `high` (`review_due_reason: high_risk`), por `hot_path` en `backend/app/api/v1/auth.py` y por la escalada del ítem 2 (seguridad: guards de rol y credenciales). RDD encendido por `global`.

**Lentes y por qué**: `risk` (guards de rol y manejo de credenciales), `resilience` (rechazos que no deben dejar escritura parcial), `readability` (contrato de API y mensajes al usuario), `reliability` (reglas de validación y auditoría). Consentimiento pre-answer `granted`, según la preferencia del dueño registrada en `AGENTS.md`.

**Resultado**: `state: approved`, autoridad quemada (`review-acknowledged/v1`, `authority: burned`). **Ningún bloqueante**, ninguna corrección abierta. Readability: cero hallazgos.

**Doce hallazgos informativos** (el cierre nativo los declara no bloqueantes y prohíbe re-correr el review de este candidato por ellos):

| Hallazgo | Lente | Lectura |
|---|---|---|
| `R1-audit-ip-proxy` / `R4-AUDIT-IP-PROXY` | risk, resilience | Ya documentado en L5 (advisory 3): `request.client.host` devuelve la IP del proxy. Se refuerza ahora: **tres** módulos dependen del helper, así que la política de proxy confiable conviene fijarla en el work unit de despliegue. |
| `R1-self-demotion-gap` | risk | Ya declarado en L13 decisión 8 y L14: quitarse el rol `administrador` a uno mismo no está prohibido por el nivel 1. Sigue siendo decisión del dueño. |
| `R3-001` / `R4-EMAIL-UNIQUENESS-RACE` | reliability, resilience | La unicidad del correo es `SELECT` y después `INSERT`: dos altas concurrentes con el mismo correo pasan el pre-chequeo y la perdedora termina en `IntegrityError` sin manejar → `500`, no el `400` con `campo` que fija el contrato. La restricción de la base preserva la integridad; lo que se rompe es la **forma del error** bajo concurrencia. **Arreglo propuesto**: capturar `IntegrityError` alrededor del `commit` y traducirlo a `400` con `campo="correo_electronico"`. |
| `R4-ROLES-REPLACE-RACE` | resilience | Mismo patrón en `PUT .../roles`: dos reemplazos simultáneos pueden colisionar en la PK de `usuario_rol` y devolver `500`. Doble submit de un formulario lento alcanza para dispararlo. |
| `R3-002` | reliability | Ningún test afirma `direccion_ip` en una fila de auditoría. Es determinístico: un `None` o una IP constante pasarían la suite. |
| `R3-003` … `R3-007` | reliability | Huecos de cobertura: guards de rol no probados en `GET /usuarios/{id}`, `PATCH` y `PUT .../roles`; orden del listado afirmado con dos usuarios de **igual** apellido (no distingue orden por `(apellido, nombre, correo)`); rama idempotente de `PUT .../roles` sin test; `offset > 0` y paginación de `/roles` sin test; cota inferior de 8 caracteres nunca afirmada como aceptada (el positivo usa 10). |

**Disposición**: todo lo anterior es trabajo posterior, en un candidato nuevo, no una razón para re-abrir este. No se arregló en esta sesión porque el cierre nativo lo clasifica como informativo y ampliar el alcance sin autorización choca con el `## Scope guard` de `AGENTS.md`. Los dos `WARNING` de concurrencia y el hueco de `direccion_ip` son los primeros candidatos para el próximo work unit de SEG.

### L16 — T6 abierta (2026-11-12)

**Pedido del usuario, textual**: «si» sobre la recomendación de cerrar los dos `WARNING` de concurrencia y pinear `direccion_ip`, y después «Dbeeria hacerlo en otra sesion? Si es así, dame el prompt necesario».

Se abre **T6** para que el trabajo exista como tarea derivable desde el documento: un carril recibe un puntero, no un prompt con la política adentro, y L15 es prosa de cierre, no una tarea con criterio de aceptación. Alcance de T6: `R3-001`/`R4-EMAIL-UNIQUENESS-RACE`, `R4-ROLES-REPLACE-RACE` y `R3-002`. Los huecos de cobertura `R3-003` a `R3-007` quedan fuera: son aserciones de tests, no defectos, y no bloquean ninguna entrega.

T6 escribe solo `backend/app/` y `backend/tests/`, no requiere migración y no toca `## Specs` ni `## Screens`.




### L17 — T4: inventario y especificaciones de pantallas de SEG (2026-11-12, carril `feat/seg-t4-inventario`)

**Producido**: `odd/design/seg-screens-draft.md`, pasos 1-3 de `odd/design/screen-design-plan.md` (inventario, patrón y especificación por pantalla). **No** incluye el paso 4: la aprobación es del dueño y todavía no ocurrió. `## Specs`, `## Screens` y `## Tasks` no se tocaron: son del integrador y del carril de T3.

**Inventario derivado** (6 UCE → 9 pantallas + 1 que no genera pantalla):

| Patrón | Pantallas |
|---|---|
| P1 | SEG-U02 Listado de usuarios, SEG-U04 Listado de auditoría |
| P2 | SEG-U05 Detalle de evento, SEG-U08 Mi perfil |
| P3 | SEG-U01 Iniciar sesión (entregada), SEG-U03 Alta/edición de usuario, SEG-U06 Solicitar recuperación, SEG-U07 Definir nueva contraseña, SEG-U09 Cambiar contraseña |

UCE–SEG-03 (Cerrar Sesión) no nombra pantalla: es una acción del armazón, ya entregada en S4 de `03-shell-frontend.md`. Se registra en el inventario para que el mapeo quede completo y no se "descubra" después como faltante.

**Hallazgo principal — cuatro pantallas dependen de endpoints sin dueño.** `GET /api/v1/auditoria`, `GET /api/v1/auditoria/{id}`, `POST /api/v1/auth/password` y los dos de recuperación no existen y ninguna tarea los cubre: T3 es CRUD de usuarios, T4 diseño, T5 frontend. Sin una tarea de backend nueva, SEG-U04, SEG-U05, SEG-U06, SEG-U07 y SEG-U09 no se implementan. T5 no puede empezar por el par P1+P3 completo: SEG-U02 y SEG-U03 sí (T3), SEG-U04 no.

**Hallazgo — el nivel 3 no tiene almacenamiento para el token de recuperación.** UCE–SEG-07 pide un token con TTL por correo; `otp` cuelga de `analisis_id` (nivel 3 L178-187) y es de otro subsistema. Se proponen dos salidas y ninguna se decide acá: token firmado sin estado (recomendada, sin migración) o tabla nueva (cambio del nivel 3, dueño integrante). Aparte, el envío por correo es una dependencia de runtime nueva y `AGENTS.md` la prohíbe sin aprobación explícita.

**Hallazgo — divergencia nivel 1 contra implementación en el bloqueo por intentos.** UCE–SEG-01 exc. paso 5 (L2360) dice que al quinto fallo la cuenta pasa a estado **«Inhabilitado»**; S5 implementa bloqueo temporal con `bloqueado_hasta` y 423, verificado en L5. El nivel 1 gana: es una divergencia de la implementación, no una decisión de pantalla. Registrado como D4 del borrador con la recomendación de dejar S5 como desvío deliberado del dueño y no escribir «cuenta inhabilitada» en la UI mientras el bloqueo sea temporal.

**Requisito faltante reportado, no diseñado**: UCE–SEG-02 define la baja lógica y ningún paso define reactivar una cuenta (G4). No se agregó el botón. Tampoco se inventó el alta de `profesional` (`matricula`, `especialidad`): ningún paso de SEG lo pide (G5).

**Decisiones abiertas del borrador**: D1 contraseña opcional en la edición de usuario; D2 multi-selección de roles (nivel 1 dice «uno», nivel 2 y S3 dicen acumulables); D3 entrada a «Mi perfil» por menú del header en vez de página del sidebar; D4 (arriba); D5 (arriba); D6 conjunto cerrado del filtro `accion`.

**Defecto de herramientas observado**: al abrir el carril, `git status` ya traía `.atl/skill-registry.md` modificado sin commit: `gentle-ai skill-registry refresh` reescribió el título y las rutas absolutas de los tres skills de alcance proyecto (`C:\Users\...\sigemi\...` → `C:\work\sigemi-t4\...`). Cada worktree genera rutas distintas, así que el archivo cambia por carril y produce conflicto por bytes que nadie editó, contra el objetivo de L10/L11 de que la base no dependa del ambiente. No se tocó ni se commiteó en este work unit (G6).

### L18 — Aprobación humana de las pantallas de SEG (2026-11-12)

**Aprobación explícita del dueño, textual**: «aprobado». Cierra el paso 4 de `odd/design/screen-design-plan.md` para `odd/design/seg-screens-draft.md` (commit `2a71c21`), presentado con las seis decisiones abiertas y su recomendación. Se lee como **aprobado tal cual**, con D1-D6 en la dirección recomendada:

| Punto | Dirección aprobada |
|---|---|
| D1 | Contraseña obligatoria en el alta, opcional en la edición («dejar en blanco para conservar») |
| D2 | Roles en multi-selección, mínimo uno (nivel 2 §6.2 + S3 + `usuario_rol`) |
| D3 | «Mi perfil» por menú del usuario en el header; el sidebar sigue siendo módulos de negocio |
| D4 | Se mantiene el bloqueo temporal de S5; la UI dice «cuenta bloqueada temporalmente», nunca «inhabilitada» |
| D5 | Token de recuperación firmado sin estado (sin migración). El envío por SMTP queda sujeto a la aprobación de dependencia que exige `AGENTS.md`, en su propio work unit |
| D6 | El filtro `accion` valida contra `{crear, modificar, eliminar, consultar}` |

**Consecuencias registradas**:

1. **D4 deja S5 como desvío deliberado del nivel 1** (UCE–SEG-01 exc. paso 5 pide estado «Inhabilitado», la implementación bloquea temporalmente). El nivel 1 no se edita. La constancia vive en este Log; si el dueño quiere que quede en `## Specs`, la escribe el integrador, porque `## Specs` no es superficie de este carril.
2. **El borrador pasa a ser especificación**: una pantalla aprobada no se rediseña durante la implementación. Si T5 encuentra un problema, se reporta y se decide, no se ajusta sobre la marcha.
3. **T4 queda terminada, pero la fila T4 de `## Tasks` sigue en ⏳**: `## Tasks` pertenece al carril de T3 (`AGENTS.md` §Parallel execution). El integrador o ese carril la marcan al mergear.
4. **T5 no está desbloqueada del todo**: SEG-U02 y SEG-U03 pueden implementarse contra T3; SEG-U04, SEG-U05, SEG-U06, SEG-U07 y SEG-U09 siguen esperando las tareas de backend de G1 y G2 más D5.

**Próximo paso concreto**: el integrador fusiona `odd/design/seg-screens-draft.md` en `## Screens` de este documento, entre `## Specs` y `## Tasks`, y agrega las tareas de backend de G1 y G2.

### L19 — Desestimación de la aprobación de L18 y corrección de la especificación (2026-11-12)

**Instrucción del usuario, textual**: «si, desestima el borrador que yo aprobé entonces, haz lo que creas correcto».

La aprobación de L18 queda **sin efecto**: el borrador aprobado no es la especificación. El motivo es que se escribió desde el carril de T4, antes de que T3 existiera, y contradice el código que ya está en `main` en tres puntos. El nivel 1 gana en el paso 6 de UCE-SEG-02, pero el contrato de la API no se puede contradecir sin que el código cambie.

| Contradicción | Borrador | Código real de T3 |
|---|---|---|
| `correo único → 409` | `409` (l.203, 178, 195) | `400` con `campo` (decisión 1 de L13). No hay `409` en el código. |
| `roles` en `PATCH /usuarios/{id}` | `PATCH` (l.187) | `UsuarioUpdate` no tiene `roles`; el reemplazo va por `PUT /usuarios/{id}/roles` (decisión 4 de L13). |
| `POST /usuarios/{id}/baja` | `POST` (l.124, 517) | `PATCH` con `estado=inactivo` (decisión 2 de L13); `DELETE` responde `405`. |

**Corrección aplicada**: `odd/design/seg-screens-draft.md` se corrige en los tres puntos, se re-verifica contra el código y se fusiona en `## Screens` de este documento. La especificación corregida **no se implementa sin aprobación explícita**: se presenta al dueño y se espera. El nivel 1 no se toca; el paso 6 de UCE-SEG-02 sigue diciendo lo que dice, y la respuesta de la API es el desvío que el contrato de `AGENTS.md` ya fija.

**Consecuencia**: T5 sigue bloqueada por la aprobación de la especificación corregida, no por el código de T3. T3 ya está entregado y aprobado.

### L20 — Integración del carril T4 y fusión de la especificación en `## Screens` (2026-11-12)

**Carril T4 fusionado**: `feat/seg-t4-inventario` entra en `main` con `--no-ff` (`8009703`). El conflicto con `02-seguridad-acceso.md` se resolvió como unión: las entradas de T3 (L13-L16) quedaron primero y las de T4 se renumeraron a **L17-L18** para no duplicar identificadores de log. La renumeración es resolución de merge, no reescritura de historia: el contenido de cada entrada es el que el carril escribió.

**Especificación fusionada**: `odd/design/seg-screens-draft.md` pasa a `## Screens` de este documento (entre `## Specs` y `## Tasks`), corregida contra el código real. Las correcciones son las de L19, más dos que aparecieron al fusionar:

1. `GET /api/v1/roles` no figuraba en la tabla de endpoints y es el selector de roles de SEG-U03. Se agregó como implementado por T3.
2. La edición de SEG-U03 usa **dos** llamadas (`PATCH` para los campos y `PUT .../roles` para el conjunto de roles), porque `UsuarioUpdate` no tiene `roles`. La tabla de acciones lo dice explícitamente.

**Tareas abiertas agregadas**: **T7** (backend de auditoría, G1) y **T8** (backend de contraseñas, G2). T7 no tiene bloqueos: `auditoria` ya existe en el nivel 3 y el servicio append-only ya está en T1. T8 tiene `POST /auth/password` libre, pero `/recuperacion` y `/confirmacion` dependen de D5 (token) y de la aprobación de la dependencia SMTP.

**T4**: se marca ✅ para los pasos 1-3 (inventario y especificación). El paso 4 (aprobación humana) sigue pendiente y **es el único bloqueo de T5** junto con T7/T8.

**Evidencia observada**: `git log --oneline -3` → `8009703 docs(seguridad): integrar el carril T4 y desestimar la aprobacion del borrador`, `c22dbb0 feat(seguridad): integrar el carril T3 de usuarios y roles`, `f98d171 docs(seguridad): abrir T6 con los hallazgos del review de T3`. `pytest -o addopts=` desde `backend/` en `main` tras el merge de T3 → **354 passed, 1 warning, 68.11 s**; `ruff check .` → `All checks passed!`; `ruff format --check .` → `46 files already formatted`.

**Pendiente de higiene**: `.atl/skill-registry.md` sigue modificado y sin commitear en los dos worktrees de carril (`C:\work\sigemi-t3`, `C:\work\sigemi-t4`). No se commitea desde un carril: la regeneración reescribe rutas absolutas del worktree y produce un conflicto por bytes que nadie editó. El integrador lo regenera una sola vez desde el árbol principal.

### L21 — Aprobación de `## Screens` (2026-11-12)

**Aprobación explícita del dueño, textual**: «si», sobre la pregunta «¿Aprobás `## Screens` tal como quedó, o querés revisar alguna pantalla antes de que T5 arranque?». Se lee como **aprobado tal cual**, sin revisión pantalla por pantalla.

Cierra el paso 4 de `odd/design/screen-design-plan.md` para la especificación de `## Screens` en su estado actual (commit `460a964`). **T4 queda ✅** (pasos 1-4).

**Consecuencia**: la especificación es vinculante. Una pantalla aprobada no se rediseña durante la implementación; si T5 encuentra un problema, se reporta y se decide, no se ajusta sobre la marcha.

**T5 sigue parcialmente bloqueada, pero ya no por la aprobación**: SEG-U02 y SEG-U03 pueden implementarse contra T3; SEG-U04, SEG-U05, SEG-U06, SEG-U07 y SEG-U09 esperan T7 (auditoría) y T8 (contraseñas) más D5 y la aprobación de la dependencia SMTP.

**Pendiente de decisión del dueño**: D4 (bloqueo temporal de S5 contra el estado «Inhabilitado» del nivel 1) queda en pie como desvío deliberado registrado; si el dueño quiere que la constancia viva en `## Specs`, la escribe el integrador. D5 (token de recuperación) sigue sin decidir formalmente, aunque la recomendación es token firmado sin estado, sin migración.


