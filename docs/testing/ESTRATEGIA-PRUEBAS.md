# Estrategia de pruebas — API (Paso 6)

| Campo | Valor |
|---|---|
| Estado | Decidida por el equipo (D-56 a D-59, 20-11) |
| Fecha | 2026-11-20 |
| Repositorio | `hexablock-api` (`docs/testing/ESTRATEGIA-PRUEBAS.md`) |
| Par | `hexablock-app/docs/testing/ESTRATEGIA-PRUEBAS.md` (misma estructura) |
| Enunciado | §3.6 (casos de prueba), §7.3 (pruebas del código generado por IA) |
| Herramientas | Jest, Supertest, `jest-openapi` o Ajv con los esquemas del contrato (ADR-001 §2.2) |

## 1. Qué pide el enunciado y dónde se cumple

| Pide (§3.6) | Cómo se cumple | Sección |
|---|---|---|
| Probar cada entidad, caso de uso y servicio de forma aislada | Pruebas unitarias de `domain/` y `application/` con dobles (D-56) | §3, §4 |
| *Mocks* o *stubs* para repositorios y servicios externos | *Fakes* en memoria por defecto; `jest.fn()` solo para verificar llamadas | §4 |
| AAA y `should_[resultado]_when_[condición]` | Convención obligatoria | §5 |
| Integración: casos de uso con repositorios reales en una base en memoria | PostgreSQL real con los datos en `tmpfs` (RAM) (D-57) | §3, §9 |
| Endpoints con clientes HTTP de prueba, incluido el filtro por `gameId` | Supertest contra la app NestJS completa | §3 |
| Flujos completos de guardar y recuperar progreso, por variante | Un flujo e2e por cada `gameId` | §3 |
| Contrato (Pact o equivalente) | Cada respuesta e2e se valida contra `openapi.yaml`; `check_contracts.py` en CI (D-23) | §3 |
| Pruebas en CI en cada PR | Workflow de GitHub Actions | §9 |

## 2. Pirámide

| Nivel | Carpeta | Base de datos | Qué prueba |
|---|---|---|---|
| Unitarias | `test/unit/` | Ninguna | Dominio (consolidación, ranking, plausibilidad, validador de niveles), casos de uso, aspectos, filtro de errores |
| Integración | `test/integration/` | PostgreSQL en `tmpfs` | Repositorios Prisma, transacción de sincronización, consultas del ranking, cursor de niveles |
| End-to-end | `test/e2e/` | PostgreSQL en `tmpfs` | Cada endpoint por HTTP con Supertest, seguridad y contrato |

## 3. Qué se prueba en cada parte

| Parte | Tipo | Qué se prueba | Dobles |
|---|---|---|---|
| `progress/domain` | Unitaria | `ProgressConsolidator` con **E-COM-2**: unión, mejor intento por variante, mismo resultado en cualquier orden, al repetir y con envío parcial (RN-COM-83, 84; D-49) | — |
| `leaderboard/domain` | Unitaria | Las 4 `IRankingPolicy` con **E-COM-3** y sus desempates (RN-COM-101 a 105) | — |
| `progress/domain` | Unitaria | `IPlausibilityPolicy`: estrellas fuera de 1–3, puntaje sobre el tope, `achievedAt` en el futuro, nivel inexistente → `implausible-result` (RN-COM-108) | `FakeClock`, `InMemoryLevelCatalog` |
| `levels/domain` | Unitaria | `LevelValidator`: reglas estructurales (RN-HF-12 a–e y g, RN-HS-12; D-19) con **E-HF-NIVEL** y sus variantes rotas | — |
| `*/application` | Unitaria | Cada caso de uso de ARQ-03-API §3 | *Fakes* de los puertos (§4) |
| Aspectos | Unitaria | `LoggingAspect` redacta contraseña y token; `MetricsAspect` mide; `CacheAspect` guarda 30 s y se invalida (D-42) | `RecordingLogger`, `jest.fn()` |
| Filtro global de errores | Unitaria | Cada error de la tabla de ARQ-03-API §2 sale como Problem Details con su `code`, sin `stack` ni valores enviados (D-51) | — |
| Repositorios Prisma | Integración | Guardar y leer de verdad; clave única de `best_attempts` con `level_id` vacío; `citext` en correo y nombre visible | PostgreSQL en `tmpfs` |
| Sincronización | Integración | **Dos sincronizaciones simultáneas** del mismo usuario no pierden progreso (`FOR UPDATE`, ARQ-04-API §3) | PostgreSQL en `tmpfs` |
| Cursor de niveles | Integración | Páginas de 100, sin repetir ni saltar niveles; un cambio aparece en la siguiente consulta; `any` solo para Sort (D-48) | PostgreSQL en `tmpfs` |
| Endpoints | E2E | Cada operación de `openapi.yaml`, con sus respuestas correctas y de error; el filtro por `gameId` (§3.6 del enunciado) | App NestJS completa |
| Flujo por variante | E2E | **Por cada `gameId`**: registrarse → `PUT /v1/me/progress/{gameId}` → `GET /v1/me/progress` → `GET /v1/leaderboard/{gameId}` → el progreso y la posición coinciden | App completa |
| Seguridad | E2E | Las pruebas de SECURITY-BASELINE: el `userId` sale solo del JWT (SEC-API-01); `role` en el cuerpo → 400 (SEC-API-03); 401 con `WWW-Authenticate`; 429 con `Retry-After`; un 500 no tiene `stack`; un 400 no repite la contraseña; contraseña de 14 caracteres → `too-short` (D-52) | App completa |
| Contrato | E2E + estática | **Cada respuesta e2e se valida contra `openapi.yaml`** (`jest-openapi`); `check_contracts.py` pasa; los ejemplos del contrato se usan como datos de prueba | — |

## 4. Dobles de prueba (D-56)

**Por defecto, *fakes* y *stubs* escritos a mano**, en `test/support/`.

| Puerto (ARQ-03-API §3) | Doble | Tipo |
|---|---|---|
| `IUserRepository`, `IProgressRepository`, `IBestAttemptRepository`, `IBestAttemptReader`, `ILevelRepository`, `ILevelCatalog` | `InMemory…` | *Fake* |
| `ITransactionRunner` | `ImmediateTransactionRunner` (ejecuta la función sin transacción) | *Fake* |
| `IPasswordHasher` | `PlainTextHasher` (rápido; argon2id se prueba aparte en integración) | *Fake* |
| `ITokenIssuer` | `FixedTokenIssuer` | *Stub* |
| `IClock` | `FakeClock` | *Fake* |
| `IHealthProbe` | `FakeHealthProbe` (sana o caída) | *Stub* |
| `ILogger`, `IMetrics` | `RecordingLogger`, `RecordingMetrics` | *Spy* |

**Cuándo un *mock* (`jest.fn()`):** solo para comprobar que algo **se llamó o no se llamó**, sin otro efecto visible. Por ejemplo: que con un resultado no plausible el repositorio no reciba ninguna escritura.

**Quién los escribe:** la IA, junto con las pruebas (D-59), y el equipo los revisa en el PR.

## 5. Convenciones

- **Nombre:** `should_[resultado]_when_[condición]`, en inglés. Ejemplo: `should_return_409_display_name_taken_when_name_exists_with_other_case`.
- **AAA:** bloques `// Arrange`, `// Act`, `// Assert`, en ese orden.
- **Un comportamiento por prueba**; el `describe` lleva el ID del ejemplo o de la regla (`describe('E-COM-2', …)`, `describe('SEC-API-03', …)`).
- **Cada prueba de integración y e2e empieza con la base vacía**: se trunca al inicio, y las pruebas no dependen del orden.
- **Sin esperas reales:** el tiempo sale de `FakeClock`; el *throttler* se prueba con un límite bajo configurado para el test.
- **Comportamiento, no detalles:** se comprueba la respuesta HTTP o lo guardado, no qué métodos internos se llamaron.

## 6. Trazabilidad

Cada ejemplo de los documentos compartidos (E-COM-2, E-COM-3, E-HF-NIVEL; RNF-22) y cada control `SEC-*` con prueba tiene su `describe` con el ID. Un script de CI lista los IDs de `docs/requirements/` y `docs/security/` y falla si alguno no aparece en `test/`.

## 7. Cobertura (D-58)

| Parte | Mínimo |
|---|---|
| `src/**/domain/**` | **90 %** de líneas |
| `src/**/application/**` | **80 %** |
| Total | **70 %** |

Se configura en `jest.config.ts` con `coverageThreshold`, que acepta un umbral por patrón de rutas; Jest **hace fallar el CI** si alguno queda debajo. `main.ts`, los módulos de NestJS y `src/prisma/` no cuentan.

## 8. Pruebas del código generado por IA (D-59)

1. La IA escribe el código **y sus pruebas** en el mismo PR, siguiendo §5.
2. Un integrante **lee y ajusta** las pruebas antes de aprobar: que prueben la regla o el control de seguridad, y no la implementación; que cubran su ejemplo o su `SEC-*`.
3. La plantilla de PR tiene una casilla para esto, y `AI_USAGE.md` dice qué ajustó cada integrante.
4. Si la revisión no alcanza, se cambia a la opción B de D-59: el integrante escribe primero las pruebas.

## 9. CI en cada PR

`.github/workflows/ci.yml`. PostgreSQL corre como *service container* con los datos en memoria (D-57):

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: hexablock_test
    ports: ["5432:5432"]
    options: >-
      --tmpfs /var/lib/postgresql/data
      --health-cmd "pg_isready -U postgres"
      --health-interval 5s --health-retries 10
```

Pasos, en orden:
1. `npm ci`
2. `npm run lint` y `npm run format:check`
3. Contrato: `python3 docs/contracts/check_contracts.py` y un linter de OpenAPI (Redocly o Spectral)
4. `npx prisma migrate deploy` sobre la base de prueba
5. `npm test -- --coverage` (unitarias, integración y e2e, con los umbrales de §7)
6. Script de trazabilidad (§6)

Costo: el repo es público, así que los *runners* estándar no gastan minutos. El contenedor suma unos segundos de arranque (D-57).

## 10. Fuera del alcance (por ahora)

| Qué | Por qué |
|---|---|
| Prueba de carga para RNF-33 (p95 ≤ 500 ms) | Se corre a mano contra el entorno de EC2 antes de la entrega, con una herramienta simple (por ejemplo `autocannon`) |
| Pruebas de mutación (Stryker) | *Could*, si sobra tiempo |
