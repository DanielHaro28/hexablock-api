---
paths:
  - "docs/**"
  - "*.md"
---

# Documentos

- Se escriben en **español**; `README.md` en inglés (enunciado §6.1).
- **IDs:** nunca se reutilizan ni se renumeran.
- **`docs/DECISIONES.md`** se edita a mano y tiene solo las decisiones que afectan al backend, con el mismo texto que en la app (D-67, D-72). Las abiertas están en `hexablock-app/docs/PENDIENTES.md`; las tareas, en Issues (D-69).
- **Documentos compartidos** (lista en `docs/README.md`): idénticos en los dos repos; se cambian con `/paired-change`.
- **Binarios:** nada de más de 1 MB (D-73).
- El CI corre los scripts de `hexablock-app/tools/docs-check/` sobre los dos repos.
