---
name: paired-change
description: Change the API contract, or a document shared with hexablock-app, in both repositories with two paired pull requests.
argument-hint: "[file or topic]"
disable-model-invocation: true
---

Cambio en el contrato o en un documento compartido: **$ARGUMENTS**.

Documentos compartidos (deben quedar idénticos en los dos repos): `docs/adr/ADR-001-tech-stack.md`, `docs/architecture/ARQ-00-SISTEMA.md`, `docs/security/SECURITY-BASELINE.md`, `docs/requirements/01-GLOSARIO.md`, `02-RN-NIVELES.md`, `02-RN-CUENTA-PROGRESO-RANKING.md` y `docs/ai/APPROVED-TOOLS.md`. El contrato `docs/contracts/` tiene su **fuente aquí**; `hexablock-app` guarda una copia (D-23).

1. Comprueba que el clon de `hexablock-app` esté al lado de este repo (`../hexablock-app`) y actualizado (`git -C ../hexablock-app pull`). Si no está, pide al usuario que lo clone.
2. Usa **el mismo nombre de rama** en los dos repos (`docs/<tema>`): el CI de documentos compara contra la rama de igual nombre del otro repo (D-72).
3. Haz el cambio aquí:
   - **Contrato:** edita `docs/contracts/`, corre `python3 -I docs/contracts/check_contracts.py` y copia la carpeta completa a `../hexablock-app/docs/contracts/` con `cp -r` (en la app, un hook bloquea editarla a mano). Si cambia un ejemplo, avisa: la app tiene pruebas que lo usan.
   - **Documento compartido:** edítalo aquí y cópialo al otro repo con `cp`.
4. Verifica con `python3 -I ../hexablock-app/tools/docs-check/check_shared.py ../hexablock-app .`.
5. Si el cambio toca una decisión, una regla o un ejemplo, actualiza `DECISIONES.md`, la trazabilidad o las pruebas en los dos repos donde aplique.
6. Un commit por repo con el mismo mensaje, y dos PR que se enlacen entre sí ("Paired with DanielHaro28/hexablock-app#<n>"). Se integran los dos, uno tras otro.
