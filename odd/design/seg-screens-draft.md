# Pantallas de Acceso y Seguridad — borrador para revisión humana

Derivado de los UCE del subsistema (nivel 1, §2.8.4), de los roles cerrados (nivel 2
§6.2) y de las tablas `usuario` / `rol` / `usuario_rol` / `profesional` / `auditoria` /
`cambio_auditoria` (nivel 3). No existe especificación previa de estas pantallas: cada
decisión de abajo cita su origen.

**Estado**: borrador. Ninguna pantalla está aprobada; T5 no arranca hasta la aprobación
(paso 4 de `odd/design/screen-design-plan.md`).

**Cómo se revisa**: tres campos por pantalla y nada más.

1. **Respaldo** — ¿cita un UCE con paso? Si no, se rechaza.
2. **Reglas y excepciones** — ¿están todas las excepciones del UCE? Si falta una, es un
   agujero funcional.
3. **Acciones** — ¿cada acción tiene endpoint o está declarada fuera de alcance?

Layout, color y espaciado no se revisan: los resuelve el armazón existente
(`PageShell`, `Btn`, `Panel`, `EmptyState`).

---

## 1. Inventario derivado

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

## 2. Especificaciones

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
| Nuevo usuario | `POST /api/v1/usuarios` *(propuesto, T3)* | siempre | abre SEG-U03 en modo alta |
| Editar | `PATCH /api/v1/usuarios/{id}` *(propuesto, T3)* | siempre | abre SEG-U03 en modo edición |
| Desactivar | `POST /api/v1/usuarios/{id}/baja` *(propuesto, T3)* | `id != usuario_actual.id` (exc. paso 7) **y** `estado == activo` | `estado = inactivo`, baja lógica |

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
| Correo electrónico | sí | `usuario.correo_electronico` | formato + único (409) |
| Contraseña | según D1 | `usuario.contrasena_hash` | S6 |
| Roles | sí, 1 o más | `usuario_rol` → `rol.codigo` | debe existir en el catálogo cerrado |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Guardar (alta) | `POST /api/v1/usuarios` *(propuesto, T3)* | formulario válido | crea usuario + roles + auditoría (paso 7) |
| Guardar (edición) | `PATCH /api/v1/usuarios/{id}` *(propuesto, T3)* | formulario válido | modifica + auditoría |
| Cancelar | — | siempre | vuelve a SEG-U02 descartando cambios |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Guardando | botón deshabilitado, sin doble submit |
| Error de campo (400/409) | mensaje en el campo, con `{"detail", "campo"}` |
| Error general | `No se pudo guardar el usuario` + Reintentar |
| Sin permiso | redirección al inicio |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Correo único | R3 | exc. paso 6 (L2384) | backend 409 + mensaje en campo |
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
| Ver detalle | `GET /api/v1/auditoria/{id}` *(propuesto, **sin dueño**)* | siempre | abre SEG-U05 |

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
| Enviar enlace | `POST /api/v1/auth/recuperacion` *(propuesto, **sin dueño**)* | correo con formato válido | siempre la misma respuesta; si existe, envía el correo (paso 5) |
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
| Guardar contraseña | `POST /api/v1/auth/recuperacion/confirmar` *(propuesto, **sin dueño**)* | formulario válido | actualiza hash, invalida el token (pasos 7-8) |
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
| Guardar | `POST /api/v1/auth/password` *(propuesto, **sin dueño**)* | formulario válido | actualiza hash + auditoría (pasos 6-7) |
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

## 3. Endpoints que estas pantallas necesitan

La columna «Dueño» es el hueco más importante de este borrador: **cuatro pantallas
dependen de endpoints que ninguna tarea tiene asignada**.

| Endpoint | Usado por | Dueño | Estado |
|---|---|---|---|
| `POST /api/v1/auth/login` | SEG-U01 | T2 | implementado |
| `GET /api/v1/auth/me` | SEG-U08 | T2 | implementado |
| `GET /api/v1/usuarios` | SEG-U02 | T3 (carril backend) | pendiente |
| `POST /api/v1/usuarios` | SEG-U03 alta | T3 | pendiente |
| `PATCH /api/v1/usuarios/{id}` | SEG-U03 edición | T3 | pendiente |
| `POST /api/v1/usuarios/{id}/baja` | SEG-U02 | T3 | pendiente |
| `GET /api/v1/auditoria` | SEG-U04 | **sin dueño** | **falta tarea de backend** |
| `GET /api/v1/auditoria/{id}` | SEG-U05 | **sin dueño** | **falta tarea de backend** |
| `POST /api/v1/auth/recuperacion` | SEG-U06 | **sin dueño** | falta tarea + decisión D5 |
| `POST /api/v1/auth/recuperacion/confirmar` | SEG-U07 | **sin dueño** | falta tarea + decisión D5 |
| `POST /api/v1/auth/password` | SEG-U09 | **sin dueño** | falta tarea de backend |

Las rutas de `usuario` y `auditoria` son **propuestas de este borrador**: T3 todavía no
escribió código, así que el contrato se confirma antes de que T5 lo consuma. T5 no se
implementa contra una ruta inventada.

---

## 4. Decisiones abiertas y huecos

Cada punto bloquea algo concreto. Ninguno se resuelve por cuenta de este borrador.

### D1 — Contraseña en la edición de usuario

El paso 4 de UCE–SEG-02 pide «contraseña» entre los datos, sin distinguir alta de
edición; la postcondición habla de datos «registrados, modificados o invalidados».

- **Recomendación**: obligatoria en el alta; **opcional en la edición** («dejar en
  blanco para conservar la actual»). Razón: un administrador que corrige un apellido no
  debería tener que inventar una contraseña, y forzarla obliga a comunicarla por un
  canal inseguro.
- **Bloquea**: SEG-U03, campo Contraseña.
- **Si se decide lo contrario**: el campo pasa a obligatorio y no cambia nada más.

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

### G1 — Endpoints de auditoría sin dueño

`GET /api/v1/auditoria` y `GET /api/v1/auditoria/{id}` no existen y **ninguna tarea los
cubre**: T3 es CRUD de usuarios, T4 diseño, T5 frontend. Sin ellos, SEG-U04 y SEG-U05 no
se implementan. Requiere una tarea de backend nueva antes de T5.

### G2 — Backend de contraseñas sin dueño

Igual que G1 para `POST /api/v1/auth/password`, `POST /api/v1/auth/recuperacion` y
`POST /api/v1/auth/recuperacion/confirmar`. Además SEG-U06/U07 arrastran D5.
**SEG-U09 también está bloqueada**: la pantalla es de una sola caja de texto, pero sin
endpoint no hay nada que probar.

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

## 5. Orden de implementación recomendado (paso 5-6 del plan)

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