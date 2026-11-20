# 05 — Matriz de trazabilidad · API (`hexablock-api`)

| Campo | Valor |
|---|---|
| Estado | Borrador para revisión del equipo |
| Fecha | 2026-11-11 |
| Repositorio | `hexablock-api`. La matriz de la app está en el mismo archivo de `hexablock-app` |

**Regla de mantenimiento:** todo PR que agregue o cambie un RF, una HU, una RN o un ejemplo actualiza esta matriz en el mismo PR. Si el cambio está en un documento **compartido**, se actualiza también la matriz de la app.

---

## 1. Enunciado → requisitos

| Enunciado | Qué pide | RF / RNF |
|---|---|---|
| §5.2 (1) | Registro e inicio de sesión con JWT | RF-70, RF-71, RNF-41 |
| §5.2 (2) | Sincronización de progreso por `gameId` | RF-72, RF-93 |
| §5.2 (3) | Ranking por `gameId` y por nivel | RF-74 |
| §5.2 (4) | Obtener y actualizar niveles con esquema genérico | RF-80, RF-81, RF-82 |
| §5.2 (5) | Swagger / OpenAPI | RF-90 |
| §5.2 (6) | Errores HTTP consistentes | RF-91 |
| §3.4 | Arquitectura limpia (aplicada al backend por coherencia) | RNF-12 |
| §3.6 | Pruebas y CI | RNF-21 a 26 |
| §6 | README en inglés y Conventional Commits | RNF-60, RNF-26 |
| §7 | Documentación del uso de IA | RNF-62 |
| §9 | Participación individual | RNF-63 |
| Cátedra | Backend siempre desplegado | RNF-32, RNF-36, RF-92 |
| Profesor (P-08) | Modo invitado y offline-first (el servidor consolida sin perder datos) | RF-72 |
| SECURITY-BASELINE | Controles de seguridad del backend | RNF-40, RNF-41, RF-93 |

## 2. Requisitos → historias → reglas → ejemplos

| RF | Historias | Reglas | Ejemplos (→ pruebas) | Pruebas |
|---|---|---|---|---|
| RF-70 | API-01 | SEC-API-02, 03, 04 | — | |
| RF-71 | API-02 | SEC-API-02, 04 | — | |
| RF-72 | API-03 | RN-COM-80, 83, 84, 86, 90, SEC-API-01 | E-COM-2 | |
| RF-74 | API-04 | RN-COM-100 a 107 | E-COM-3 | |
| RF-80 | LVL-01 | RN-COM-70, 72, 75 | — | |
| RF-81 | LVL-02 | RN-COM-70, 71, SEC-API-05 | — | |
| RF-82 | LVL-02 | RN-COM-71, 76, RN-HF-12 (a–e, g), RN-HS-12 | E-HF-NIVEL (y sus variaciones a y d) | |
| RF-90 | TEC-05 | — | — | |
| RF-91 | TEC-05 | SEC-API-08 | — | |
| RF-92 | TEC-05, TEC-10 | — | — | |
| RF-93 | API-03 | RN-COM-108, SEC-API-06 | — | |

**Historias sin RF (solo RNF):** TEC-04 (RNF-24 a 26), TEC-10 (RNF-32, 36).

**RF solo de la app** (en `hexablock-app`): RF-01 a 64, RF-73 (usa RF-72 del servidor), RF-75, RF-83.

## 3. Ejemplos → pruebas

| Ejemplo | Documento | Qué prueba | Prueba |
|---|---|---|---|
| E-COM-2 | `02-RN-CUENTA-PROGRESO-RANKING.md` | Consolidación: unión, máximo y mejor intento; repetirla no cambia nada. **Mismos datos que en la app** | |
| E-COM-3 | `02-RN-CUENTA-PROGRESO-RANKING.md` | Orden del ranking por nivel (Fit y Sort) | |
| E-HF-NIVEL | `02-RN-NIVELES.md` | Nivel válido aceptado; variaciones que fallan (a) y (d) → 400. La variación que falla (f) **pasa** en el backend (se valida en la app) | |
| Seguridad | `SECURITY-BASELINE.md` §8 | Las 12 pruebas del backend | |

## 4. Chequeos de cobertura

| Chequeo | Resultado |
|---|---|
| Cada punto de §5.2 tiene al menos un RF | ✅ |
| Cada RF tiene al menos una historia | ✅ |
| Cada historia tiene un RF o un RNF | ✅ |
| Cada ejemplo compartido tiene prueba en ambos repos | ⏳ Pendiente (durante la implementación) |
| Decisiones abiertas | ⚠️ D-03 (respuesta 409 en el registro) |
