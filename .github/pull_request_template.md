## What does this PR do?

<!-- One or two sentences. Link the issue: Closes #<n> -->

## Story / rules

- Story: <!-- e.g. API-03 -->
- Business rules: <!-- e.g. RN-COM-83, SEC-API-01 -->

## Self-review checklist

- [ ] Title follows Conventional Commits in English (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- [ ] Tests added or updated (unit and/or e2e), named `should_<result>_when_<condition>`, following AAA.
- [ ] CI is green (lint, unit, e2e, contract).
- [ ] `domain/` folders do not import NestJS or Prisma.
- [ ] The user id comes from the JWT, never from the URL or body; responses never include emails.
- [ ] `openapi.yaml` updated if an endpoint or DTO changed.
- [ ] No secrets, tokens or real user data in code, tests or prompts.
- [ ] `AI_USAGE.md` updated if AI was used in this PR.

## Sensitive changes

- [ ] This PR changes agent, CI or deploy configuration (`CLAUDE.md`, `.claude/`, `.clinerules`, `.github/workflows/`, `deploy/`) or security docs → I told the team.
