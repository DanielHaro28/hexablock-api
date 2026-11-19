# 04 — Historias de usuario (v2) · API (`hexablock-api`)

| Campo | Valor |
|---|---|
| Estado | Borrador para revisión del equipo |
| Fecha | 2026-11-11 (v1 del 28-10-2026 por el equipo) |
| Repositorio | `hexablock-api` (`docs/requirements/04-HISTORIAS.md`). Las historias de la app están en el mismo archivo de `hexablock-app` |
| Relacionados | `02-RN-CUENTA-PROGRESO-RANKING.md`, `02-RN-NIVELES.md` (compartidos), `03-REQUISITOS.md`, `05-TRAZABILIDAD.md` |

## Cómo se separan las historias entre repos

- Las historias que tocan app y servidor (**API-01, API-02, API-03, LVL-01, TEC-04**) aparecen en **los dos repos con el mismo ID**. Cada repo tiene los criterios de su lado: aquí, los del servidor.
- Las historias solo de servidor (**API-04, LVL-02, TEC-05, TEC-10**) están solo aquí.
- En GitHub se crea **un Issue por repo**, con el mismo ID en el título y la etiqueta `api`.

**Formato:** Como [rol], quiero [acción], para [beneficio]. Criterios Dado / Cuando / Entonces; cada criterio se convierte en al menos una prueba. Prioridad (MoSCoW) · RF que cubre · reglas que aplica.

**Roles:** jugador (desde la app), jugador registrado, administrador de contenido, equipo de desarrollo.

| Épica | Prefijo | Historias |
|---|---|---|
| 7. Cuenta, sincronización y ranking (parte servidor) | API | 4 |
| 8. Niveles remotos (parte servidor) | LVL | 2 |
| 9. Historias técnicas (API) | TEC | 3 |
| **Total** | | **9** (6 funcionales + 3 técnicas) |

---

## Épica 7 · Cuenta, sincronización y ranking (parte del servidor)

### API-01 · Registrarme ↔ también en `hexablock-app`
Como jugador, quiero crear una cuenta, para guardar mi progreso en el servidor.
- Dado un correo no registrado y datos válidos, cuando me registro, entonces se crea la cuenta y recibo un JWT.
- Dado un correo ya registrado, entonces recibo **409** con un mensaje claro _(decisión D-03)_.
- Dado un nombre visible que ya usa otra cuenta (sin distinguir mayúsculas), entonces recibo **409** con el código `display-name-taken` (RN-COM-109).
- Dados datos inválidos o campos no permitidos (como `role`), entonces recibo **400** con el detalle por campo (SEC-API-03).
- Dada una contraseña de menos de 15 o más de 128 caracteres, o que está en la lista de contraseñas comunes, entonces recibo **400** con `too-short`, `too-long` o `too-common` en `/password`, sin que se repita la contraseña (SEC-API-02, D-52).
- La contraseña se guarda con argon2id, nunca en texto plano.
- Más de 5 intentos por minuto desde la misma IP → **429** (SEC-API-04).

**Must** · RF-70 · RN-COM-109 · SEC-API-02, 03, 04

### API-02 · Iniciar sesión ↔ también en `hexablock-app`
Como jugador registrado, quiero iniciar sesión, para acceder a mi progreso.
- Dadas credenciales correctas, entonces recibo un JWT con expiración.
- Dadas credenciales incorrectas, entonces recibo **401** sin revelar si el correo existe.
- Dado un token ausente, expirado o con la firma alterada en un endpoint protegido, entonces recibo **401**.
- Más de 5 intentos por minuto desde la misma IP → **429**.

**Must** · RF-71 · SEC-API-02, 04

### API-03 · Sincronizar mi progreso por juego ↔ también en `hexablock-app`
Como jugador registrado, quiero que el servidor guarde y combine mi progreso, para no perderlo si cambio de teléfono.
- Existe una entrada de progreso por usuario y `gameId`, con una sección por figura de celda (topología; RN-TOP-33, D-27).
- Dado que envío resultados de una variante (todos o solo los que cambiaron, D-49), entonces el servidor los **consolida** con el guardado (RN-COM-83) y me devuelve el resultado.
- Dado que envío el mismo progreso dos veces, entonces el resultado no cambia (RN-COM-84, E-COM-2).
- Dado que pido mi progreso, entonces recibo el de las 4 variantes (RN-COM-90).
- El usuario siempre sale del JWT; nunca puedo leer ni escribir el progreso de otro (SEC-API-01).
- Dado un resultado no plausible, entonces recibo **400** (RN-COM-108).

**Must** · RF-72, RF-93 · RN-COM-80, 83, 84, 86, 90, 108, SEC-API-01, 06

### API-04 · Consultar el ranking
Como jugador, quiero consultar el ranking global, para compararme con otros.
- Dado que consulto el ranking de una variante y una figura, entonces recibo los mejores resultados filtrados por `gameId` y topología, ordenados según RN-COM-101 a 105 (Fit por nivel: estrellas → tiempo → movimientos; Sort por nivel: movimientos → puntaje).
- Dado que la variante es por niveles, entonces puedo consultar el ranking de un nivel.
- Dado que tengo sesión, entonces la respuesta incluye mi posición aunque no esté en la página.
- La respuesta nunca incluye correos (RN-COM-106) y está paginada (máximo 100).

**Must** · RF-74 · RN-COM-100 a 107, SEC-API-03, 04

---

## Épica 8 · Niveles remotos (parte del servidor)

### LVL-01 · Entregar niveles publicados ↔ también en `hexablock-app`
Como jugador, quiero que la app reciba los niveles nuevos, para tener más contenido sin actualizarla.
- Dado que se piden los niveles de una variante y figura sin cursor, entonces la API devuelve la primera página (hasta 100) de los publicados, con su versión, su topología y el cursor siguiente (RN-COM-70, 75, 77).
- Dado un cursor, entonces solo llegan los niveles creados o actualizados después de él; si no hay cambios, la lista viene vacía.
- No existe un endpoint para borrar niveles.

**Must** · RF-80 · RN-COM-70, 72, 75, 77

### LVL-02 · Publicar o actualizar un nivel
Como administrador de contenido, quiero crear o modificar un nivel por la API, para ampliar el juego sin tocar el código de la app.
- Dado que tengo rol de administrador, cuando envío un nivel válido, entonces se guarda con su versión y queda disponible.
- Dado que el nivel no cumple el esquema o una validación **estructural** de su variante (RN-COM-76, RN-HF-12 a–e y g, RN-HS-12), entonces recibo **400** con el detalle.
- Dado que no soy administrador, entonces recibo **403**; sin token, **401**.
- Antes de publicar, el administrador pasa el nivel por el validador de la app, que hace también la validación geométrica (RN-HF-12 f).

**Must** · RF-81, RF-82 · RN-COM-70, 71, 76, RN-HF-11, 12, RN-HS-11, 12, SEC-API-05

---

## Épica 9 · Historias técnicas (API)

### TEC-04 · Integración continua del backend ↔ también en `hexablock-app` (su propio CI)
Como equipo de desarrollo, quiero que GitHub Actions ejecute las pruebas en cada PR, para no integrar código roto a `main`.
- Cada PR a `main` ejecuta lint, pruebas unitarias, de integración (con Postgres) y de contrato.
- `main` está protegida: todo cambio entra por PR con CI en verde; no se exige la aprobación de otra persona, pero el autor completa la checklist de la plantilla de PR.
- Los commits siguen Conventional Commits y se validan.

**Must** · RNF-24, 25, 26

### TEC-05 · API documentada y con errores consistentes
Como equipo de desarrollo, quiero documentar la API con OpenAPI y estandarizar los errores, para que cliente y backend compartan un contrato claro.
- Swagger cubre todos los endpoints, se genera desde `openapi.yaml` y está público en `/docs`.
- Todos los errores siguen Problem Details (RFC 9457) con `code` y `errors`, y nunca exponen el stack ni los valores enviados (SEC-API-08, D-51).
- Existe `GET /health`, que responde 200 cuando la API y la base de datos están disponibles.

**Must** · RF-90, RF-91, RF-92, RNF-25, RNF-32

### TEC-10 · Despliegue continuo en AWS
Como equipo de desarrollo, quiero que cada integración a `main` se despliegue sola en EC2, para que el backend esté siempre disponible y actualizado.
- Al integrar a `main`, CI construye la imagen Docker, la publica en GHCR y actualiza EC2 por SSH desde el Environment `production` (SEC-WEB-03).
- Las migraciones de Prisma se aplican al arrancar el contenedor.
- Después del despliegue, una prueba de humo verifica `/health` por HTTPS.
- Un workflow programado consulta `/health` cada hora (RNF-32).

**Must** · RNF-32, RNF-36 · SEC-WEB-01, 03
