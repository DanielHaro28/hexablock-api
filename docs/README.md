# Documentación de `hexablock-api`

Índice de los documentos de diseño del backend (NestJS + PostgreSQL). Los documentos están en español; el `README.md` de la raíz del repo va en inglés (enunciado §6.1).

## Estructura

```
docs/
├── README.md                              ← este índice
├── DECISIONES.md                          ← decisiones cerradas que afectan al backend (las compartidas, con el mismo texto que en hexablock-app)
├── adr/
│   └── ADR-001-tech-stack.md              [compartido]
├── architecture/
│   ├── ARQ-00-SISTEMA.md                  [compartido] vista del sistema (app + API + EC2)
│   ├── ARQ-01-API-GENERAL.md           arquitectura general de este repo
│   ├── ARQ-03-API-DETALLE.md           casos de uso, puertos, aspectos AOP, patrones y SOLID (Paso 4)
│   └── ARQ-04-API-DATOS.md             esquema Prisma, sincronización, ranking y cursor de niveles (Paso 5)
├── contracts/                          FUENTE ÚNICA del contrato (D-23): openapi.yaml, schemas/, examples/, check_contracts.py
├── testing/
│   └── ESTRATEGIA-PRUEBAS.md           pirámide, dobles, PostgreSQL en tmpfs, cobertura, pruebas del código de IA y CI (Paso 6)
├── diagrams/                           clases.puml (PlantUML), capas.mmd y datos.mmd (Mermaid) + imágenes .png
├── security/
│   └── SECURITY-BASELINE.md               [compartido]
└── requirements/
    ├── 01-GLOSARIO.md                     [compartido]
    ├── 02-RN-NIVELES.md                   [compartido]
    ├── 02-RN-CUENTA-PROGRESO-RANKING.md   [compartido]
    ├── 03-REQUISITOS.md                   RF y RNF de la API
    ├── 04-HISTORIAS.md                    historias de la API
    └── 05-TRAZABILIDAD.md                 enunciado → RF → HU → RN → pruebas (API)
```

Se irá agregando con los siguientes pasos: `ops/` (despliegue en EC2).

**Lo que no está aquí:**
- Las **reglas de juego** (variantes y topologías) viven solo en `hexablock-app`, porque el backend no ejecuta partidas. El backend solo necesita las reglas de **niveles** y de **cuenta, progreso y ranking**, que están compartidas.
- La lista de **pendientes del proyecto** (con las decisiones abiertas) vive solo en `hexablock-app/docs/PENDIENTES.md`.
- Las decisiones que solo afectan a la app (reglas internas de las variantes y motor genérico) están en `hexablock-app/docs/DECISIONES.md`.

## Documentos compartidos con `hexablock-app`

Los marcados **[compartido]** existen en los dos repos y deben ser **idénticos**. Un cambio se hace con un PR en cada repo, con el mismo contenido, y se enlazan entre sí. El revisor comprueba que las dos copias queden iguales.

## Orden de lectura sugerido (para integrantes nuevos o para una IA)

1. `ADR-001-tech-stack.md`: qué se usa y por qué (sobre todo §2.2 a §2.4).
2. `ARQ-00-SISTEMA.md` y `ARQ-01-API-GENERAL.md`: cómo está organizado el sistema y la API. `ARQ-03-API-DETALLE.md`: casos de uso, aspectos y patrones.
3. `01-GLOSARIO.md`: el vocabulario.
4. `02-RN-CUENTA-PROGRESO-RANKING.md`: consolidación y ranking, el corazón del backend.
5. `02-RN-NIVELES.md`: esquema y validación de niveles.
6. `03-REQUISITOS.md` y `04-HISTORIAS.md`: qué hay que construir.
7. `SECURITY-BASELINE.md`: §3 (API) y §4 (infraestructura y CI).
