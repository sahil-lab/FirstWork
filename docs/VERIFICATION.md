# Phase 0-1 verification

## Execution boundary

Work is confined to `C:\Users\upadhsah\Desktop\project\FirstWork`. The complete three-page
guide was read. No other session was activated, no other project container was stopped,
and no Git initialization, commit, remote, push, real data access, destructive volume
operation, or cloud deployment was performed.

This report records observed checks only. The local CI definition is not evidence that a
hosted CI run occurred. No benchmark or production-readiness claim is made.

## Environment observed

| Item               | Observed value                                      |
| ------------------ | --------------------------------------------------- |
| Initial project    | Only the 9,695-byte engineering PDF                 |
| Docker server      | 29.4.1, Linux containers                            |
| Docker Compose     | v5.1.3                                              |
| Tool Node          | 22.23.4 in `node:22-bookworm-slim`                  |
| Tool Java          | Temurin 21.0.9 in `maven:3.9.11-eclipse-temurin-21` |
| Runtime Java       | Temurin 21.0.13 in `eclipse-temurin:21-jre-alpine`  |
| Runtime PostgreSQL | 16.15 in `postgres:16-alpine`                       |
| Runtime Nginx      | 1.28.2 in `nginxinc/nginx-unprivileged:1.28-alpine` |
| Host runtimes      | Host Node 14 not used; no Java on PATH              |
| Git                | No repository; initialization not authorized        |
| Reserved ports     | No initial listener on 18108 or 18208               |

## Reproducible commands

Run these from PowerShell:

```powershell
Set-Location 'C:\Users\upadhsah\Desktop\project\FirstWork'
.\scripts\firstwork.ps1 -Action Start
.\scripts\verify-runtime.ps1 -ExerciseDatabaseOutage
.\scripts\firstwork.ps1 -Action Smoke
.\scripts\firstwork.ps1 -Action Status
```

`Start` initializes a local secret without overwriting an existing one, runs Java and
frontend checks, builds images from verified artifacts, starts only FirstWork, waits for
health, and runs real Chromium smoke tests. The outage check pauses **only FirstWork's
database**, always attempts to unpause it in a `finally` block, and verifies recovery. It
never deletes a volume or a row.

Equivalent explicit commands:

```powershell
docker compose -p firstwork -f infra\docker\compose.yaml config --quiet
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-check node scripts/initialize-local.mjs
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps api-check
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-check
docker compose -p firstwork -f infra\docker\compose.yaml up --detach --build --wait --wait-timeout 180 db api web
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps smoke
```

After deliberate source changes, format with:

```powershell
.\scripts\firstwork.ps1 -Action Format
.\scripts\firstwork.ps1 -Action Check
```

The first lockfile is generated after manifest edits using:

```powershell
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-check npm install --no-audit --no-fund
```

Normal subsequent runs use `npm ci`, not a floating dependency update.

## Observed result ledger

The documented `.\scripts\firstwork.ps1 -Action Format` followed by
`.\scripts\firstwork.ps1 -Action Start` was executed end to end successfully. The rerun
retained the existing database secret, reran all 20 Java and 7 frontend tests, rebuilt the
artifacts/images, waited for all three healthy services, and passed all 6 browser/API
tests. This was an existing-volume restart, not a separate clean-host or hosted-CI
experiment.

Obsolete Windows bind-mounted dependency copies from the initial failed test approach were
removed using only their two exact project-local paths. The working named dependency
volumes, database volume, credentials, source files, and reports were retained.

| Check                                                         | Result                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Entire PDF read, repository inspected                         | Passed                                                                                          |
| Docker engine, Compose, cached Java/Node runtime checks       | Passed                                                                                          |
| Compose schema validation (`config --quiet`)                  | Passed                                                                                          |
| PowerShell parser checks for both scripts                     | Passed                                                                                          |
| npm installation and lockfile                                 | Passed; 105 packages, exact lockfile, subsequent offline `npm ci` passed                        |
| Java formatting, unit tests, compilation, packaging           | Passed; Spotless, Java 21 compile, 20 tests, zero failures/errors/skips, executable JAR         |
| Frontend formatting, lint, unit tests, type checking, build   | Passed; Prettier, Oxlint with zero warnings/errors, 7 tests, strict TypeScript, Vite build      |
| Runtime image build and health                                | Passed; db/api/web healthy                                                                      |
| Browser/API/PostgreSQL smoke                                  | Passed; 6 Chromium/API E2E tests, zero retries                                                  |
| Integrated browser inspection                                 | Passed; live dashboard and migrated schema visible; responsive layout inspected                 |
| Loopback bindings, internal database network, resource limits | Passed via `verify-runtime.ps1`; non-root/read-only runtime, dropped capabilities               |
| Database interruption and recovery                            | Passed; liveness 200/UP, readiness 503/DOWN, system 503; all recovered after unpause            |
| Real schema inspection                                        | Passed; Flyway `1:true`; only `flyway_schema_history` and `prototype_metadata` in public schema |
| Hosted CI                                                     | Not run; no remote repository or push is authorized                                             |

### Exact observed API results

Healthy `GET /api/v1/system`:

```json
{
  "service": "firstwork-api",
  "phase": "phase-1",
  "schemaVersion": "phase-1",
  "database": "reachable",
  "syntheticOnly": true
}
```

The browser sent `{"reference":"synthetic-smoke","synthetic":true}` and received HTTP 200
with:

```json
{
  "reference": "synthetic-smoke",
  "accepted": true,
  "persisted": false
}
```

Negative HTTP checks rejected false confirmation, invalid prefixes, string booleans,
unknown fields, and malformed JSON with 400; plain text returned 415. Java tests
additionally covered missing/null fields, numeric/boolean coercion, empty input, uppercase
references, and the 64/65-character boundary. Domain routes and sensitive Actuator
endpoints returned 404.

### Failures observed and fixes verified

1. Initial Prettier output for one chained mock expression did not pass the immediate
   format check. Simplifying the response fixture removed the unstable expression;
   formatting then passed.
2. The first Vitest run using Windows bind-mounted dependencies timed out starting both
   workers, with **no tests executed**. Dependencies were moved into FirstWork-only Docker
   volumes and restored from the existing npm cache. The same seven tests then passed
   without relaxed timeouts or retries.
3. Oxlint reported synchronous state updates in an effect. Loading state now changes in
   the refresh event; zero-warning linting passed.
4. Docker could not allocate another default subnet. Read-only inspection of occupied
   subnets and host routes preceded assigning `198.18.108.0/28` only to the new FirstWork
   frontend network. Startup then passed that gate; no network was pruned and no daemon
   setting was changed.
5. Nginx attempted to create a FastCGI temp directory on its read-only root. All Nginx
   temp paths now use the bounded writable `/tmp` mount.
6. During a command interruption, API and DB containers were later observed exited with
   code 255. Starting web alone consequently failed DNS lookup for `api`. Starting **only
   FirstWork's** db/api/web dependency chain restored service; all six smoke tests passed.
   The external interruption's cause was not established.
7. The runtime verification helper treated native `psql -c` as a PowerShell parameter
   abbreviation. Native arguments are now forwarded with `@args`. Actual migration,
   network, resource, pause/unpause, and recovery checks passed.

Initial external dependency downloads were slow (npm reported 53 minutes; the first Maven
download/build run reported 1 hour 8 minutes). These are environment observations, not
application benchmarks. Cached verification is used for subsequent runs.

## Artifacts and resource budget

- Java package and Surefire reports: `services/api/target/`.
- Frontend build: `apps/web/dist/`.
- Browser reports and failure artifacts: `.local/reports/` and `.local/test-results/`.
- Generated credentials: `.local/secrets/`, excluded from Git and image builds.
- Frontend dependency volumes: `firstwork_web-modules` and
  `firstwork_web-workspace-modules`, not shared with other projects.
- Runtime limits: API 512 MiB / 0.75 CPU; PostgreSQL 256 MiB / 0.5 CPU; web 64 MiB / 0.25
  CPU. Total configured runtime limit: 832 MiB / 1.5 CPUs.
- Verification containers: Java 1 GiB / 1 CPU, frontend 768 MiB / 1 CPU, Chromium 1 GiB /
  1 CPU. Runtime and test memory have finite PID limits as well.
- Compilation and test stages are sequenced; initial independent dependency downloads may
  overlap. Image storage is managed by the shared Docker daemon, not quota-isolated by
  Compose.

## Changed-file inventory

The PDF was preserved. Because Git is not initialized, this is a file inventory, not a Git
diff. All source/configuration files below were added in this run. Generated caches,
secret contents, reports, and build products are not source files and are ignored.

- Root: [README.md](../README.md), [.gitignore](../.gitignore),
  [.gitattributes](../.gitattributes), [.dockerignore](../.dockerignore),
  [.prettierrc.json](../.prettierrc.json), [.prettierignore](../.prettierignore),
  [package.json](../package.json), [package-lock.json](../package-lock.json),
  [playwright.config.mjs](../playwright.config.mjs).
- CI: [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- Documentation: [PRD.md](PRD.md), [ARCHITECTURE.md](ARCHITECTURE.md),
  [THREAT_MODEL.md](THREAT_MODEL.md), [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md),
  [VERIFICATION.md](VERIFICATION.md).
- Frontend: [package.json](../apps/web/package.json),
  [.gitignore](../apps/web/.gitignore), [.oxlintrc.json](../apps/web/.oxlintrc.json),
  [index.html](../apps/web/index.html), [tsconfig.json](../apps/web/tsconfig.json),
  [tsconfig.app.json](../apps/web/tsconfig.app.json),
  [tsconfig.node.json](../apps/web/tsconfig.node.json),
  [vite.config.ts](../apps/web/vite.config.ts), [App.tsx](../apps/web/src/App.tsx),
  [App.css](../apps/web/src/App.css), [index.css](../apps/web/src/index.css),
  [main.tsx](../apps/web/src/main.tsx), [api.ts](../apps/web/src/api.ts),
  [App.test.tsx](../apps/web/src/App.test.tsx),
  [api.test.ts](../apps/web/src/api.test.ts),
  [test/setup.ts](../apps/web/src/test/setup.ts).
- API: [pom.xml](../services/api/pom.xml),
  [FirstWorkApplication.java](../services/api/src/main/java/com/firstwork/prototype/FirstWorkApplication.java),
  [JsonConfiguration.java](../services/api/src/main/java/com/firstwork/prototype/JsonConfiguration.java),
  [SystemController.java](../services/api/src/main/java/com/firstwork/prototype/SystemController.java),
  [SandboxController.java](../services/api/src/main/java/com/firstwork/prototype/SandboxController.java),
  [ApiExceptionHandler.java](../services/api/src/main/java/com/firstwork/prototype/ApiExceptionHandler.java),
  [application.yaml](../services/api/src/main/resources/application.yaml),
  [V1__bootstrap_metadata.sql](../services/api/src/main/resources/db/migration/V1__bootstrap_metadata.sql),
  [ApiControllerTest.java](../services/api/src/test/java/com/firstwork/prototype/ApiControllerTest.java).
- Contract: [openapi.yaml](../packages/contracts/openapi.yaml).
- Infrastructure: [compose.yaml](../infra/docker/compose.yaml),
  [api.Dockerfile](../infra/docker/api.Dockerfile),
  [web.Dockerfile](../infra/docker/web.Dockerfile),
  [nginx.conf](../infra/docker/nginx.conf).
- Commands: [firstwork.ps1](../scripts/firstwork.ps1),
  [verify-runtime.ps1](../scripts/verify-runtime.ps1),
  [initialize-local.mjs](../scripts/initialize-local.mjs).
- E2E: [smoke.spec.mjs](../tests/e2e/smoke.spec.mjs).
- Empty reserved directories: [worker](../services/worker/.gitkeep) and
  [benchmarks](../benchmarks/.gitkeep); no worker or benchmark is implemented.

## Limitations and next step

Only a diagnostic skeleton is in scope. Authentication, tenant isolation, permissions,
audit records, retry/idempotency semantics, domain entities, onboarding decisions,
uploads, malware scanning, OCR, human review, events, agents, OpenTelemetry export, cloud
deployment, and benchmarking are not implemented or certified.

Wait for Phase 2 authorization. Resolve identity/roles/tenancy and audit ownership before
designing domain writes. Git initialization needs separate approval if it is desired.
