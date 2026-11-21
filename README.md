# hexablock-api
HexaBlock Suite – NestJS REST API: auth, progress sync, leaderboards and levels

## Versions

Exact versions used by the team, by CI and in production (R-01). Upgrading any of them is a PR that changes this table and the files where it is pinned.

| Tool | Version | Notes |
|---|---|---|
| Node.js | 26 LTS (26.13.1 when this was written) | Active LTS until 27-10-2027 (ADR-001 §2.2). T-04 pins it in `.nvmrc`, `engines` in `package.json`, the Docker image (`node:26-alpine`) and CI |
| NestJS | 12.5.0 | `@nestjs/*` packages, pinned by `package-lock.json` (T-04) |
| Prisma ORM | 7.10.1 (`prisma` and `@prisma/client`) | Prisma ORM 7, not 8 (D-89) |
| PostgreSQL | 18.7 | `postgres:18.7-alpine` in `docker-compose.yml`, the CI service container and EC2 |

The app versions (Flutter, Dart) are in the README of [hexablock-app](https://github.com/DanielHaro28/hexablock-app#versions).
