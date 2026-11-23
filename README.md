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

## Getting started

Requirements: Node.js (see `.nvmrc`), npm and Docker.

```bash
cp .env.example .env                                       # then fill in the values; .env is never committed
npm ci
npx prisma generate                                        # creates the Prisma Client in src/prisma/generated
docker compose -f docker-compose.dev.yml up -d postgres    # PostgreSQL on localhost:5433
npx prisma migrate deploy                                  # applies the migrations
npm run start:dev                                          # API on http://localhost:3000
```

Once it runs: `GET /health` (API and database) and the Swagger UI in `/docs`, generated from [`docs/contracts/openapi.yaml`](docs/contracts/openapi.yaml). Every error is Problem Details (RFC 9457) with a `code`.

| Command | What it does |
|---|---|
| `npm run lint` · `npm run format:check` | ESLint (includes the Clean Architecture import rules) and Prettier |
| `npm test` | Unit tests (no database) |
| `npm run test:e2e` | HTTP tests of the whole application with the real global pipeline; responses are checked against `openapi.yaml`. They use fakes for the database when they can |
| `npm run test:integration` | Tests against a real PostgreSQL (`DATABASE_URL` must point to a test database that has the migrations) |
| `npm run test:cov` | All tests with the coverage thresholds of D-58 |
| `npm run build` | Compiles to `dist/` |

Source layout and layers: [`docs/architecture/ARQ-01-API-GENERAL.md`](docs/architecture/ARQ-01-API-GENERAL.md).
