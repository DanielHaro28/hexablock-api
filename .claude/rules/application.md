---
paths:
  - "src/modules/*/application/**"
---

# Casos de uso y puertos (capa 2)

Diseño: `docs/architecture/ARQ-03-API-DETALLE.md`.

- **Un caso de uso por clase**, que implementa `UseCase<I, O>` con `execute` (D-38). Lista de casos de uso y puertos en §3.
- **Los puertos son interfaces** de esta capa (`IUserRepository`, `IBestAttemptReader`…); sus implementaciones van en `infrastructure/`. **No importes `infrastructure/`** (ESLint lo impide).
- **Lectura y escritura separadas** donde se decidió (ISP): `leaderboard` solo usa `IBestAttemptReader`.
- **La sincronización** corre en una transacción con `ITransactionRunner` y bloqueo de la fila (`FOR UPDATE`, ARQ-04-API).
- **Registro, métricas y caché son aspectos** (decoradores en `common/`, D-42); los casos de uso no llaman al logger.
