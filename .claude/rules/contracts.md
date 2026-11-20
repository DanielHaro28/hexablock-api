---
paths:
  - "docs/contracts/**"
---

# Contrato (fuente única, D-23)

- Este repo tiene la **fuente**; `hexablock-app` guarda una copia idéntica que el CI de documentos compara byte a byte. Todo cambio aquí se lleva a la app con `/paired-change`, en dos PR con el mismo nombre de rama.
- Después de cambiar algo, corre `python3 -I docs/contracts/check_contracts.py`.
- **Compatibilidad**: no quites ni renombres campos que la app ya usa. Si un cambio rompe la app, es una decisión del equipo.
- Los ejemplos (`examples/`) son pruebas compartidas: si cambias uno, cambia también su prueba en los dos repos.
