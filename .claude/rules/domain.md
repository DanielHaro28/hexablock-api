---
paths:
  - "src/modules/*/domain/**"
---

# Dominio (capa 1)

- **TypeScript puro**: nada de `@nestjs/*`, `@prisma/client` ni librerías de infraestructura. Lo comprueba una regla de ESLint (`no-restricted-imports`, ARQ-01-API §8).
- **Las reglas vienen de los documentos compartidos** `docs/requirements/02-RN-CUENTA-PROGRESO-RANKING.md` y `02-RN-NIVELES.md`. La consolidación (`ProgressConsolidator`) tiene que dar **exactamente** lo mismo que la de la app: se prueba con E-COM-2 y E-COM-3 de `docs/contracts/examples/` (ARQ-S-03).
- **El servidor no ejecuta partidas**: las políticas de plausibilidad (`IPlausibilityPolicy`) solo descartan resultados imposibles (ARQ-S-02, SEC-API-06).
- **Orden del ranking** por política (`IRankingPolicy`): Fit por estrellas, tiempo y movimientos del mismo intento (P-07); Sort por movimientos y puntaje (D-04).
- **Errores** como subclases de `DomainError` con su `code` en kebab-case (D-39); el filtro global los traduce a Problem Details.
