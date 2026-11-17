# 03 — Requisitos funcionales y no funcionales · API (`hexablock-api`)

| Campo | Valor |
|---|---|
| Estado | Borrador para revisión del equipo |
| Fecha | 2026-11-11 |
| Repositorio | `hexablock-api` (`docs/requirements/03-REQUISITOS.md`). Los requisitos de la app están en el mismo archivo del repo `hexablock-app` |
| Relacionados | `02-RN-CUENTA-PROGRESO-RANKING.md`, `02-RN-NIVELES.md` (compartidos), `04-HISTORIAS.md`, `05-TRAZABILIDAD.md`, `docs/security/SECURITY-BASELINE.md` |

**Requisitos compartidos:** los RF de cuenta, sincronización, ranking y niveles remotos (RF-70 a 82) tienen una **parte del servidor** (aquí) y una **parte de la app** (en `hexablock-app`), con el **mismo ID**.

**Cómo se reparte el contenido:**
- Un **RF** dice **qué** hace la API, en una línea, y apunta a las reglas (RN) que dicen **cómo**. Los nombres exactos de los endpoints se fijan en `openapi.yaml` (Paso de contratos).
- Un **RNF** es un atributo de calidad **medible**, con su forma de **verificación**.

**Prioridad (MoSCoW):** **Must** = exigido por el enunciado, la cátedra o el profesor; **Should** = importante, no exigido; **Could** = si sobra tiempo.

---

## 1. Requisitos funcionales

### 1.1 Cuenta

| ID | La API… | Reglas | Fuente | Prioridad |
|---|---|---|---|---|
| RF-70 | Registra usuarios con correo, contraseña y nombre visible; guarda la contraseña con argon2id y devuelve un JWT. Correo repetido → 409; datos inválidos o campos no permitidos (como `role`) → 400 con detalle por campo | SEC-API-02, SEC-API-03 | §5.2 (1) | Must |
| RF-71 | Inicia sesión y devuelve un JWT con expiración. Credenciales incorrectas → 401 genérico (no revela si el correo existe). Token ausente, expirado o alterado en un endpoint protegido → 401 | SEC-API-02, SEC-API-04 | §5.2 (1) | Must |

### 1.2 Progreso

| ID | La API… | Reglas | Fuente | Prioridad |
|---|---|---|---|---|
| RF-72 | Recibe el progreso completo de una variante y figura del usuario autenticado (`gameId` y topología obligatorios), lo **consolida** con el guardado y devuelve el resultado; también entrega el progreso de las 4 variantes. El usuario siempre sale del JWT, nunca de la URL ni del cuerpo | RN-COM-80, 83, 84, 86, 90, SEC-API-01 | §5.2 (2) | Must |
| RF-73 | _(Sin parte de servidor: importar el progreso de invitado usa la misma sincronización de RF-72)_ | RN-COM-88 | P-08 | — |
| RF-93 | Rechaza resultados no plausibles (puntaje negativo o por encima del tope de la variante, estrellas fuera de 1–3, nivel inexistente, `gameId` desconocido) | RN-COM-108, SEC-API-06 | Seguridad | Must |

### 1.3 Ranking

| ID | La API… | Reglas | Fuente | Prioridad |
|---|---|---|---|---|
| RF-74 | Entrega el ranking por `gameId` y figura (topología) y, en Fit y Sort, por nivel, ordenado según la variante, paginado (máximo 100 por página), con nombre visible y **sin correos**; con sesión, incluye la posición del usuario | RN-COM-100 a 107, SEC-API-03, SEC-API-04 | §5.2 (3) | Must |

### 1.4 Niveles

| ID | La API… | Reglas | Fuente | Prioridad |
|---|---|---|---|---|
| RF-80 | Entrega los niveles publicados de una variante, con su versión | RN-COM-70, 72, 75 | §5.2 (4) | Must |
| RF-81 | Permite a un **administrador** crear o actualizar un nivel; usuario sin rol → 403; sin token → 401 | RN-COM-70, 71, SEC-API-05 | §5.2 (4) | Must |
| RF-82 | Valida cada nivel antes de guardarlo: esquema común + validaciones **estructurales** de su variante; error → 400 con detalle | RN-COM-71, 76, RN-HF-12 (a–e, g), RN-HS-12 | §5.2 (4), D-19 | Must |

### 1.5 Transversales

| ID | La API… | Reglas | Fuente | Prioridad |
|---|---|---|---|---|
| RF-90 | Documenta todos los endpoints con Swagger / OpenAPI, público en `/docs` | — | §5.2 (5) | Must |
| RF-91 | Responde los errores con un formato único `{ code, message, details }`, códigos HTTP correctos y sin stack trace | SEC-API-08, SEC-WEB-07 | §5.2 (6) | Must |
| RF-92 | Expone `GET /health`, que responde 200 cuando la API y la base de datos están disponibles | — | ADR-001 | Must |

---

## 2. Requisitos no funcionales

| ID | Atributo | Criterio medible | Verificación | Fuente | Prioridad |
|---|---|---|---|---|---|
| RNF-12 | **Arquitectura del backend** | Módulos por dominio (auth, progress, leaderboard, levels). Controladores delgados; la consolidación y los criterios de ranking viven en servicios de dominio sin dependencias de NestJS ni de Prisma; el acceso a datos está detrás de repositorios | Revisión de código; pruebas unitarias de dominio sin base de datos | §3.4 (por coherencia) | Should |
| RNF-21 | **Suite de pruebas** | Pruebas unitarias (consolidación, ranking, validación de niveles) y de integración de endpoints contra Postgres, incluido el **filtrado por `gameId`**. AAA y nombres `should_[resultado]_when_[condición]` | CI | §3.6 | Must |
| RNF-22 | **Ejemplos como pruebas** | Los ejemplos de los documentos compartidos (E-COM-2, E-HF-NIVEL y sus variaciones) tienen prueba en el backend, con los **mismos datos** que en la app | Matriz de trazabilidad | Este documento | Must |
| RNF-23 | **Cobertura** | Backend ≥ 80 % de líneas | Reporte de cobertura en CI con umbral | Equipo | Should |
| RNF-24 | **Integración continua** | Cada PR ejecuta lint, pruebas unitarias, pruebas de integración y de contrato; no se puede integrar a `main` con CI en rojo | Protección de `main` | §3.6 | Must |
| RNF-25 | **Contrato de la API** | Todas las respuestas cumplen `openapi.yaml`, que es la fuente única del contrato | Pruebas de contrato en CI | §3.6 (recomendado), ADR-001 | Should |
| RNF-26 | **Mantenibilidad** | 0 advertencias del linter; formato automático; Conventional Commits en inglés validados | CI + commitlint | §6.2 | Must |
| RNF-32 | **Disponibilidad** | La API está desplegada y responde por HTTPS; `/health` responde 200. Objetivo ≥ 99 % durante la semana de la defensa | Workflow programado que consulta `/health` cada hora | Cátedra (siempre desplegado) | Must |
| RNF-33 | **Tiempo de respuesta** | p95 ≤ 500 ms en sincronización y ranking con carga baja | Prueba de carga simple, una vez | Equipo | Could |
| RNF-36 | **Despliegue reproducible** | Al integrar a `main`, CI construye la imagen Docker, la publica y actualiza EC2 sin pasos manuales; las migraciones se aplican al arrancar | Workflow de deploy; prueba de humo con `/health` | ADR-001 | Must |
| RNF-40 | **Seguridad** | Todos los controles **Must** de `docs/security/SECURITY-BASELINE.md` del backend están implementados y verificados | Pruebas de SECURITY §8 | SECURITY-BASELINE | Must |
| RNF-41 | **Autenticación** | JWT con algoritmo fijo y expiración; contraseñas con argon2id; nunca en texto plano | Pruebas E2E de autenticación | §5.2 (1) | Must |
| RNF-60 | **README** | README del backend en inglés con todas las secciones de §6.1 | Revisión antes de la entrega | §6.1 | Must |
| RNF-62 | **Uso de IA** | `AI_USAGE.md` del backend con todo lo de §7.2, actualizado en cada PR que use IA | Revisión de PR | §7 | Must |
| RNF-63 | **Participación** | Cada integrante tiene commits significativos en su cuenta | Historial de Git | §9 | Must |
