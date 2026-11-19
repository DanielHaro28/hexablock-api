# ARQ-03 — Arquitectura detallada del backend (Paso 4)

| Campo | Valor |
|---|---|
| Estado | **Decidido (19-11-2026)**: D-38, D-39, D-42 y D-43 (`docs/DECISIONES.md`) |
| Fecha | 2026-11-19 |
| Repositorio | `hexablock-api` (`docs/architecture/ARQ-03-API-DETALLE.md`) |
| Parte de | `ARQ-01-API-GENERAL.md` (módulos, estructura, recorrido de una petición) y D-22 |
| Fija | Forma de los casos de uso, errores, casos de uso y puertos por módulo, aspectos AOP, mecanismos HTTP de NestJS, patrones y ejemplos de SOLID |
| No fija | Rutas y DTOs definitivos (`openapi.yaml`), esquema Prisma (Paso 5) |
| Diagramas | `docs/diagrams/clases.puml` (PlantUML) y `capas.mmd` (Mermaid) |

> Las rutas de esta página son orientativas; las definitivas quedan en `docs/contracts/openapi.yaml` (Paso 5, D-23). El código va en inglés.

---

## 1. Forma de los casos de uso (D-38)

La misma idea que en la app: **una interfaz**, un método, y la entrada como un solo objeto.

```ts
// src/common/application/use-case.ts
export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
```

Cada caso de uso es **una clase** en `application/` de su módulo (D-22). El controlador solo traduce HTTP → entrada y salida → DTO. El `userId` **siempre** viene del JWT, nunca del cuerpo ni de la URL (SEC-API-01).

## 2. Errores (D-39)

- **Por dentro, excepciones tipadas.** El dominio y los casos de uso lanzan errores de la aplicación (`DomainError` y sus subclases); los adaptadores traducen los de Prisma, argon2 o JWT a esos mismos tipos.
- **Hacia afuera, una respuesta uniforme.** En el backend, el borde no es una pantalla sino la respuesta HTTP. El **filtro global de errores** de NestJS cumple el papel del `Result` de la app: convierte cada error tipado en `{ code, message, details }` con su código HTTP y nunca muestra un *stack* (RF-91, SEC-API-08).

| Error | Lo lanza | HTTP | `code` |
|---|---|---|---|
| `ValidationError` (con detalle por campo) | `ValidationPipe`, validador de niveles | 400 | `validation-failed` |
| `ImplausibleResultError` | Política de plausibilidad (RN-COM-108) | 400 | `implausible-result` |
| `UnauthorizedError` | Guard de JWT, `LoginUseCase` (mensaje genérico) | 401 | `unauthorized` |
| `ForbiddenError` | Guard de roles | 403 | `forbidden` |
| `NotFoundError` | Repositorios | 404 | `not-found` |
| `ConflictError` | `RegisterUserUseCase` (correo ya registrado, D-03) | 409 | `email-taken` |
| Límite de peticiones | Throttler | 429 | `too-many-requests` |
| Cualquier otro | — (error de programación) | 500 | `internal-error`, y se registra con el *correlation id* |

## 3. Casos de uso y puertos por módulo

| Módulo | Caso de uso | Entrada → salida | Puertos que usa | Ruta orientativa |
|---|---|---|---|---|
| `auth` | `RegisterUserUseCase` | `RegisterInput` → `AuthResult` (JWT) | `IUserRepository`, `IPasswordHasher`, `ITokenIssuer` | `POST /auth/register` |
| `auth` | `LoginUseCase` | `Credentials` → `AuthResult` | `IUserRepository`, `IPasswordHasher`, `ITokenIssuer` | `POST /auth/login` |
| `progress` | `GetProgressUseCase` | `{ userId }` → progreso de las 4 variantes | `IProgressRepository` | `GET /me/progress` |
| `progress` | `SyncProgressUseCase` | `{ userId, gameKey, snapshot }` → progreso consolidado | `IProgressRepository`, `IBestAttemptRepository`, `ILevelCatalog`, `ITransactionRunner` | `PUT /me/progress/{gameId}/{topology}` |
| `leaderboard` | `GetLeaderboardUseCase` | `LeaderboardQuery` (+ `userId?`) → página + posición propia | `IBestAttemptReader` | `GET /leaderboard/{gameId}` |
| `levels` | `ListLevelsUseCase` | `{ gameId, topology, since? }` → niveles publicados | `ILevelRepository` | `GET /levels` |
| `levels` | `UpsertLevelUseCase` (admin) | `LevelDefinition` → nivel guardado | `ILevelRepository` | `POST /levels`, `PUT /levels/{id}` |
| `health` | `CheckHealthUseCase` | — → estado | `IHealthProbe` | `GET /health` |

**Dominio de cada módulo** (sin NestJS ni Prisma, D-22):

| Módulo | Clases de dominio |
|---|---|
| `users` | `User`, `Role` (el rol nunca se acepta del cliente, SEC-API-03) |
| `progress` | `VariantProgress`, `BestAttempt`, `ProgressConsolidator` (RN-COM-83, 84: la misma regla y los mismos ejemplos que la app, ARQ-S-03), `IPlausibilityPolicy` con una implementación por `gameId` |
| `leaderboard` | `IRankingPolicy` con `EndlessRanking` (Lines, Merge), `FitLevelRanking` (P-07), `SortLevelRanking` (D-04) y `LevelsGlobalRanking` (RN-COM-104); `RankingPolicies` elige la política por `gameId` |
| `levels` | `LevelDefinition`, `LevelValidator` (esquema común + una sección por `gameId`, validación estructural, D-19) |

**Adaptadores** (`infrastructure/`, capa 3): `PrismaUserRepository`, `PrismaProgressRepository`, `PrismaBestAttemptRepository`, `PrismaLevelRepository`, `PrismaTransactionRunner`, `Argon2PasswordHasher`, `JwtTokenIssuer`, `PrismaHealthProbe`. **Capa 4**: `main.ts`, `PrismaService`, los `*.module.ts` y la configuración (D-22).

## 4. Aspectos AOP (D-42)

Clases decoradoras sobre `UseCase<I, O>`, en `src/common/application/aspects/` (capa 2). Solo dependen de puertos (`ILogger`, `IMetrics`, `IClock`).

| Aspecto | Patrón | Qué hace | A qué casos de uso |
|---|---|---|---|
| `LoggingAspect<I, O>` | Decorator | Registra inicio, fin, duración y resultado con el *correlation id*. **Redacta** `password`, `token` y correos (SEC-WEB-06) | Todos |
| `MetricsAspect<I, O>` | Decorator | Mide la duración y avisa si supera el presupuesto | `SyncProgress` y `GetLeaderboard` (los más costosos) |
| `CacheAspect<I, O>` | Proxy de caché | Guarda la respuesta unos segundos por clave de entrada | `GetLeaderboard` (30 s, sin la posición propia, que se calcula aparte) |

```ts
// src/common/application/aspects/logging.aspect.ts
export class LoggingAspect<I, O> implements UseCase<I, O> {
  constructor(
    private readonly inner: UseCase<I, O>,
    private readonly logger: ILogger,
    private readonly name: string,
    private readonly redactor: Redactor = new Redactor(['password', 'token', 'email']),
  ) {}

  async execute(input: I): Promise<O> {
    const started = Date.now();
    this.logger.debug(`${this.name} started`, this.redactor.apply(input));
    try {
      const output = await this.inner.execute(input);
      this.logger.info(`${this.name} finished`, { ms: Date.now() - started });
      return output;
    } catch (error) {
      this.logger.warn(`${this.name} failed`, { error: (error as Error).name });
      throw error; // the global exception filter turns it into the HTTP response
    }
  }
}
```

**Ensamblado.** Cada `*.module.ts` registra el caso de uso **ya envuelto** con un `useFactory`. Así el controlador recibe `UseCase<I, O>` y no sabe que hay aspectos:

```ts
// src/modules/leaderboard/leaderboard.module.ts
{
  provide: GET_LEADERBOARD,
  inject: [PrismaBestAttemptRepository, LOGGER, METRICS, CLOCK],
  useFactory: (repo, logger, metrics, clock) =>
    new CacheAspect(
      new MetricsAspect(new LoggingAspect(new GetLeaderboardUseCase(repo), logger, 'GetLeaderboard'),
        metrics, clock, 'GetLeaderboard'),
      clock, { ttlSeconds: 30 }),
}
```

El orden es el mismo que en la app: lo de afuera decide si hace falta ejecutar (caché), después se mide y lo más cercano al caso de uso registra.

**Lo propio de HTTP queda en NestJS** (no es AOP sobre casos de uso, sino tubería web):

| Necesidad | Mecanismo de NestJS | Control |
|---|---|---|
| Autenticación y roles, con denegación por defecto | Guards | SEC-API-02, 05 |
| Validación de entrada con *whitelist* | `ValidationPipe` global | SEC-API-03 |
| Límite de peticiones | `@nestjs/throttler` | SEC-API-04 |
| Respuesta de error uniforme | Filtro global de excepciones | RF-91, SEC-API-08 |
| Registro de accesos HTTP (método, ruta, estado, duración, *correlation id*; 401, 403, 429 y 5xx) | Interceptor de acceso | SEC-WEB-06 |

## 5. Patrones del backend (para el README)

| Patrón | Categoría | Dónde (ruta prevista) |
|---|---|---|
| Factory Method | Creacional | `RankingPolicies.for(gameId)`, `PlausibilityPolicies.for(gameId)`: crean la política de cada variante |
| Singleton (por inyección) | Creacional | Proveedores de NestJS (alcance por defecto) |
| Decorator | Estructural | `LoggingAspect`, `MetricsAspect` |
| Proxy | Estructural | `CacheAspect` |
| Adapter | Estructural | Repositorios Prisma, `Argon2PasswordHasher`, `JwtTokenIssuer` |
| Strategy | Comportamiento | `IRankingPolicy`, `IPlausibilityPolicy`, validadores de sección por `gameId` |
| Template Method | Comportamiento | `LevelValidator.validate()`: esquema común fijo y un *hook* por variante |
| Chain of Responsibility | Comportamiento | La tubería de NestJS: throttler → guard → pipe → controlador (la provee el framework) |

## 6. SOLID, con un ejemplo cada uno

| Principio | Ejemplo | Por qué lo cumple |
|---|---|---|
| **S** | `SyncProgressUseCase` solo orquesta; `ProgressConsolidator` consolida; `PrismaProgressRepository` guarda | Cambiar la regla de consolidación no toca la persistencia |
| **O** | Una variante nueva agrega su `IRankingPolicy` y su `IPlausibilityPolicy` y se registra por `gameId` | `GetLeaderboardUseCase` no cambia |
| **L** | `GetLeaderboardUseCase` ordena con cualquier `IRankingPolicy` | No pregunta por la variante |
| **I** | `IBestAttemptReader` (lectura, `leaderboard`) separado de `IBestAttemptRepository` (escritura, `progress`) | `leaderboard` no puede escribir intentos |
| **D** | Los casos de uso dependen de `IPasswordHasher` y de `IUserRepository`; `Argon2PasswordHasher` y `PrismaUserRepository` los implementan en `infrastructure/` | ESLint impide que `domain/` y `application/` importen Prisma (ARQ-01-API §8) |

## 7. Diagramas (D-43)

| Diagrama | Fuente editable | Imagen para el README | Cómo se genera |
|---|---|---|---|
| Clases | `docs/diagrams/clases.puml` | `docs/diagrams/clases.png` | DanielHaro28, con la extensión de PlantUML de VS Code |
| Capas Clean | `docs/diagrams/capas.mmd` | `docs/diagrams/capas.png` | Generada con Mermaid al escribirlo |

El diagrama de extensibilidad es del juego: vive en `hexablock-app`.
