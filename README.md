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
npm ci                                                     # also installs the commit-msg hook (D-123)
npx prisma generate                                        # creates the Prisma Client in src/prisma/generated
docker compose -f docker-compose.dev.yml up -d postgres    # PostgreSQL on localhost:5433
npx prisma migrate deploy                                  # applies the migrations
npm run start:dev                                          # API on http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run lint` · `npm run format:check` | ESLint (includes the Clean Architecture import rules) and Prettier |
| `npm test` | Unit tests (no database) |
| `npm run test:integration` · `npm run test:e2e` | Tests against PostgreSQL (`DATABASE_URL` must point to a test database) |
| `npm run test:cov` | All tests with the coverage thresholds of D-58 |
| `npm run build` | Compiles to `dist/` |

Commit messages follow Conventional Commits in English: `npm ci` installs a `commit-msg` hook (`lefthook.yml`) that runs `commitlint` (`commitlint.config.js`), and the `pr-title` job of `.github/workflows/ci.yml` checks the PR title with the same rules, because squash merges use it as the commit on `main`.

Source layout and layers: [`docs/architecture/ARQ-01-API-GENERAL.md`](docs/architecture/ARQ-01-API-GENERAL.md).
