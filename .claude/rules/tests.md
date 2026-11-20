---
paths:
  - "test/**"
  - "src/**/*.spec.ts"
---

# Pruebas

Estrategia completa: `docs/testing/ESTRATEGIA-PRUEBAS.md`.

- **Nombre** `should_<resultado>_when_<condición>`, en inglés; bloques `// Arrange`, `// Act`, `// Assert`; un comportamiento por prueba.
- **El `describe` lleva el ID** del ejemplo o del control (`describe('E-COM-2', …)`, `describe('SEC-API-03', …)`). El CI falla si un ID de los documentos no tiene prueba.
- **Dobles** (D-56): *fakes* y *stubs* escritos a mano; *mocks* de Jest solo para comprobar que algo se llamó o no se llamó.
- **Integración y e2e**: PostgreSQL en tmpfs como servicio de CI (D-57); cada prueba empieza con la base vacía y no depende del orden.
- **Sin esperas reales**: `FakeClock`; el throttler se prueba con un límite bajo configurado para la prueba.
- **Cobertura mínima** (D-58): la del documento; el CI falla por debajo.
- Si escribiste las pruebas, dilo en el PR para que una persona las revise (D-59).
