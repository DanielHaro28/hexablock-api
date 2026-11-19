# DECISIONES — hexablock-api

> Registro de las **decisiones cerradas** que afectan a `hexablock-api`: las del equipo (`D-*`) y las respuestas del profesor o del enunciado (`P-*`).
>
> - Las decisiones **abiertas** están en `hexablock-app/docs/PENDIENTES.md` §1.1. Al cerrarse, pasan aquí con su fecha y se borran de allí.
> - Este archivo solo tiene las decisiones que afectan al backend; el registro completo del proyecto está en `hexablock-app/docs/DECISIONES.md`.
> - Las decisiones que afectan a los dos repos aparecen **con el mismo texto** en el `DECISIONES.md` de `hexablock-app` (columna *Repos*: **Ambos**). Si cambian, se cambian en los dos.
> - Si un documento citado en *Dónde quedó* no está en este repo, está en `hexablock-app`.
> - Una decisión cerrada solo se reabre si el equipo lo decide explícitamente. Los IDs nunca se reutilizan.
>
> **Última actualización:** 2026-11-19

---

## 1. Decisiones del equipo

### Organización y flujo de trabajo

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-01 | Los repos están en la cuenta de **DanielHaro28**, que los creó y los administra | ADR-001 §2.4 | Ambos | 11-11 |
| D-24 | La protección de `main` exige PR y CI en verde, pero **no** la aprobación de otra persona; autorrevisión con la plantilla de PR y revisión de un compañero recomendada | ADR-001 §2.4, SECURITY §7, SEC-AGT-05, 07 | Ambos | 11-11 |

### Cuenta, progreso y ranking

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-04 | Ranking por nivel de Hexa Sort: **movimientos ↑ → puntaje ↓** (menos pilas colocadas primero; el puntaje desempata) | RN-COM-103, RN-HS-71 | Ambos | 11-11 |
| D-05 | Al iniciar sesión con progreso de invitado, la app **pregunta** "¿importar tu progreso?"; si acepta, se consolida | RN-COM-88 | Ambos | 11-11 |
| D-06 | Al cerrar sesión, el dispositivo **vuelve al perfil invitado** con su propio progreso; el de la cuenta queda guardado localmente | RN-COM-89 | Ambos | 11-11 |

### Reglas de juego

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-10 | Hexa Fit: colocar/mover/retirar cuentan como movimiento; rotar/deshacer/rehacer no. **Estrellas independientes:** ★ completar + ★ movimientos ≤ `m` + ★ tiempo ≤ `t`. Por eso un nivel completado tiene de 1 a 3 estrellas, que es lo que valida el servidor | RN-HF-61 a 64, E-HF-1, RN-COM-108, SEC-API-06 | Ambos | 11-11 |
| D-12 | Puntaje de Hexa Sort: 1 por ficha transferida + 100 por meta (solo desempata el ranking; ver D-04) | RN-HS-60 | Ambos | 11-11 |

### Topologías (figura de las celdas)

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-18 | **Topologías:** solo rejillas regulares. Hexágonos (dominio + app, Must); cuadrados y triángulos (dominio + app 2D, Should); cubos (dominio con pruebas, Should; vista 3D, Could) | RN-COM-18, RN-TOP-01 a 04 | Ambos | 11-11 |
| D-25 | **El jugador elige la figura de las celdas en Ajustes** (solo las disponibles; hexágonos por defecto). La figura se fija al crear la partida y **no se puede cambiar durante ella**: la opción se bloquea mientras haya una partida en curso o en pausa | RN-COM-19, RN-COM-113, RN-TOP-30, 31; RF-09; NAV-08 | Ambos | 11-11 |

### Arquitectura general (Paso 2)

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-22 | **Estructura del backend:** módulos por área (`auth`, `users`, `progress`, `leaderboard`, `levels`, `health`) con `domain/` (capa 1), `application/` (capa 2: casos de uso y puertos), `presentation/` e `infrastructure/` (capa 3: controladores y DTOs; adaptadores que implementan los puertos, como repositorios Prisma, argon2 y JWT). `main.ts`, `src/prisma/` y la configuración de NestJS son capa 4. **Un caso de uso por clase.** Cómo se guarda el progreso (JSON) queda para D-27 | ARQ-01-API §2 a §4, ARQ-B-01, 02 | API | 17-11 |
| D-23 | **Contrato entre app y API:** `openapi.yaml` y los ejemplos compartidos (E-COM-2, E-COM-3, E-HF-NIVEL) viven en `hexablock-api/docs/contracts/`, la fuente única. La API valida sus respuestas contra ese archivo; la app guarda una **copia** para probar sus mappers y su CI **falla si la copia difiere** de la del repo de la API (es la herramienta "equivalente a Pact" del enunciado §3.6) | ARQ-00 §6 (ARQ-S-05), ARQ-01-API §9 (ARQ-B-05) | Ambos | 17-11 |

### Arquitectura detallada (Paso 4)

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-38 | **Forma de los casos de uso:** una interfaz única `UseCase<TIn, TOut>` con un solo método `execute` (en Dart `Future<TOut> execute(TIn input)`; en TypeScript `execute(input: I): Promise<O>`). La entrada es un solo objeto o *record*. Así un mismo aspecto envuelve cualquier caso de uso (enunciado §3.5) | ARQ-03-APP §1, ARQ-03-API §1 | Ambos | 19-11 |
| D-39 | **Errores:** por dentro, **excepciones tipadas** (los adaptadores traducen los errores técnicos a excepciones de la aplicación y el caso de uso no las maneja); hacia afuera, una salida uniforme: en la app, un **`Result` *sealed*** (éxito o fallo tipado) que entrega el aspecto de errores a la pantalla; en el backend, el **filtro global de errores** de NestJS convierte cada error tipado en `{ code, message, details }` (RF-91). Sin librerías externas (D-21). Las excepciones no tipadas son errores de programación | ARQ-03-APP §2, ARQ-03-API §2 | Ambos | 19-11 |
| D-42 | **AOP en el backend:** clases decoradoras sobre `UseCase<I, O>` (registro con redacción, métricas y caché del ranking), igual que en la app. Lo propio de HTTP queda en los mecanismos de NestJS: guards (JWT y roles), filtro global de errores, `ValidationPipe`, throttler y el registro de accesos HTTP de SEC-WEB-06 | ARQ-03-API §4; ARQ-01-API §5 (ARQ-B-04) | API | 19-11 |
| D-43 | **Diagramas:** el de clases en **PlantUML** (notación UML de plantilla, §4.1; se mantiene P-11), un archivo por repo; las imágenes las genera DanielHaro28 con la extensión de PlantUML de VS Code, sin robot de CI. Capas y extensibilidad en **Mermaid**, con imágenes generadas y comprobadas al escribirlos. Todo en `docs/diagrams/` | docs/diagrams/, ADR-001 §2.5 | Ambos | 19-11 |

### Contratos (Paso 5)

| ID | Decisión | Dónde quedó | Repos | Fecha |
|---|---|---|---|---|
| D-27 | **Progreso, récord y ranking separados por figura (opción B).** En el servidor, **una entrada de progreso por usuario y `gameId`** (cumple el enunciado §5.2 al pie de la letra) con **una sección por figura** dentro del JSON. La sincronización es `PUT /v1/me/progress/{gameId}` con las secciones que cambiaron, y el servidor consolida sección por sección. `BEST_ATTEMPT` lleva la columna `topology`, porque el ranking la filtra | RN-TOP-33, RN-COM-80, 100; ARQ-01-API §6 y ARQ-B-03 | Ambos | 19-11 |
| D-44 | **Sesión: un solo JWT válido 24 h (opción A).** Al vencer, la app pide iniciar sesión antes de sincronizar y se sigue jugando sin conexión (RN-COM-87). El token de renovación (refresh) queda para después: sería un endpoint nuevo y no rompe el contrato | SEC-API-02 | Ambos | 19-11 |
| D-45 | **Forma del progreso: dos formas según el modelo de progreso (opción B, `IProgressModel`).** Récord para Lines y Merge (`kind: "highScore"`, con el mejor puntaje y su fecha) y niveles para Fit y Sort (`kind: "levels"`, un mapa `levelId` → mejor intento; un nivel está completado si aparece en el mapa). Una consolidación por forma; una 5.ª variante reutiliza una de las dos | RN-COM-80, ARQ-B-03; esquema en `docs/contracts/` (Paso 5) | Ambos | 19-11 |
| D-46 | **Convenciones de la API (opción A).** Se apoyan en estándares: fechas ISO 8601 / RFC 3339 en UTC; códigos de estado, `ETag` y `304` según HTTP (RFC 9110). Y en convenciones muy usadas, aunque no son norma: versión mayor en la ruta (`/v1`, como Google AIP-185; `/health` queda sin versión) y nombres en `camelCase` (Google JSON Style Guide). Duraciones en milisegundos, usuarios con UUID, paginación con `limit` (1–100, 20 por defecto) y `offset`. El formato de errores sigue siendo el de D-39 hasta que se cierre D-51 | ARQ-03-API §3; `openapi.yaml` (Paso 5) | Ambos | 19-11 |
| D-50 | **Nombre visible único (opción A):** sin distinguir mayúsculas, de 3 a 20 caracteres (letras, números, espacio, `_`, `-` y `.`). Si ya existe, `409` con el código `DISPLAY_NAME_TAKEN` | RN-COM-109, glosario, RF-70, API-01 | Ambos | 19-11 |

Las decisiones que solo afectan a la app (reglas internas de las variantes, paquetes de la app, partida guardada y motor genérico: D-07 a D-09, D-11, D-13 a D-17, D-21, D-29 a D-35 y D-37) están en `hexablock-app/docs/DECISIONES.md`.

## 2. Respuestas del profesor y del enunciado

> **Indicación del profesor (11-11):** lo que el enunciado no especifica **lo decide el equipo**. Por eso no quedan preguntas abiertas: las que el enunciado no resolvía pasaron a decisiones del equipo.

| ID | Pregunta | Respuesta | Fuente | Repos | Fecha |
|---|---|---|---|---|---|
| P-01 | ¿Se aceptan repos públicos? | **Sí** | Profesor | Ambos | 11-11 |
| P-07 | Orden del ranking por nivel de Hexa Fit | **Estrellas (desc) → tiempo (asc) → movimientos (asc)**, comparando el **mismo intento** completo (no la mejor estrella de un intento con el mejor tiempo de otro) | Profesor | Ambos | 11-11 |
| P-08 | ¿Jugar sin cuenta y sincronizar después? | **Sí**. Modo invitado con progreso local; un usuario registrado sin conexión sigue jugando y sincroniza al reconectar. API-05 pasa de *Should* a **Must** | Profesor | Ambos | 11-11 |
| P-09 | ¿Basta con endpoints de admin + Swagger para publicar niveles? | **Sí**: §5.2 pide un "endpoint para obtener y actualizar la definición de niveles"; no pide interfaz de administración | Enunciado §5.2 | Ambos | 11-11 |
| P-10 | ¿Historias técnicas como HU o aparte? | El enunciado no exige HU: **decisión del equipo**. Se mantienen como historias habilitadoras (TEC) en el backlog | Enunciado (no lo regula) | Ambos | 11-11 |
| P-11 | ¿Mermaid o notación UML de plantilla en el diagrama de clases? | **Notación UML de plantilla** (§4.1) → diagrama de clases en **PlantUML** | Enunciado §4.1 | Ambos | 11-11 |
