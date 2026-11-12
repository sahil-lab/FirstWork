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

## UI enhancement verification - 2026-11-12

This follow-up changes presentation and diagnostic UX only. The earlier Phase 0-1 ledger
above remains a record of the initial implementation, not a new claim that Java tests or a
database outage experiment were rerun for a UI-only change. Git already contained a clean
initial import at the start of the UI task; this task performed no Git initialization,
commit, or remote operation.

### Changes

- New responsive workspace shell, brand treatment, forest/lime palette, shared typography
  scale, compact sidebar, mobile navigation, and local runtime map.
- Runtime status remains database-backed. Loading and failed checks do not advertise
  connected dependencies; successful checks display their actual browser-local timestamp.
  Monitoring remains manual.
- The request lab provides inline invalid-reference feedback, a character counter,
  mandatory synthetic confirmation, disabled invalid/pending submits, expandable live
  request JSON, actual response JSON, and focused reset behavior. Reset clears consent and
  previous success; no input is persisted.
- Native disclosures, skip navigation, focus indicators, and reduced-motion support
  preserve keyboard access without an additional UI framework.
- Planned workers, document review, and later build phases are explicitly labeled as
  unimplemented. No fake worker counts or decision metrics were added.

### Observed results

| Check                                       | Observed result                                                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Prettier                                    | Passed                                                                                                                            |
| Oxlint                                      | Zero warnings and errors                                                                                                          |
| Frontend unit tests                         | 10 passed                                                                                                                         |
| Strict TypeScript and Vite production build | Passed                                                                                                                            |
| Chromium/API smoke suite                    | 12 passed, zero retries                                                                                                           |
| Responsive layout and anchor navigation     | Passed at 320, 390, 768, 1024, 1280, and 1440 CSS pixels; no document-level horizontal overflow                                   |
| Request lab                                 | Actual successful response, JSON preview/response, invalid-input feedback, reset, and consent checks passed                       |
| Keyboard                                    | Skip link focuses main; native JSON disclosure toggles with Enter; reset focuses the reference input                              |
| Failure path                                | Visible API failure; explicit refresh restores connected status                                                                   |
| Visual inspection                           | Full-page desktop (1440 px) and mobile (390 px) screenshots inspected                                                             |
| Readability refinement                      | Initial tiny captions replaced with a shared 10-17 px UI type scale; mobile request input measured at 16 px                       |
| Focused text contrast                       | 104 rendered text elements inspected; no normal-sized checked text below 4.5:1 after palette refinement                           |
| FirstWork runtime verification              | API/db/web healthy; configured CPU/memory/PID limits, non-root/read-only runtime, private DB and reserved loopback ports verified |
| Backend changes / Java rerun                | None / not rerun for this UI-only increment                                                                                       |
| Hosted CI                                   | Not run                                                                                                                           |

The focused contrast probe evaluated visible text on solid backgrounds, excluding disabled
controls, decorative SVGs, and gradient/code panels. This is not a full WCAG audit or a
claim of accessibility certification. The phrase "10000 times" was treated as a request
for a substantial redesign, not a measurable multiplier.

### Reproduce the UI checks and local web update

```powershell
Set-Location 'C:\Users\upadhsah\Desktop\project\FirstWork'
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-check sh -c 'npm exec -- prettier --write apps/web/src tests/e2e/smoke.spec.mjs && npm run check'
docker compose -p firstwork -f infra\docker\compose.yaml up --detach --build --no-deps --wait --wait-timeout 90 web
.\scripts\firstwork.ps1 -Action Smoke
.\scripts\verify-runtime.ps1
```

The actual UI commands used the existing named dependency volumes; no dependency
installation or global runtime replacement was necessary. API and database containers were
not rebuilt or restarted.

### Changed files in the UI increment

- [App.tsx](../apps/web/src/App.tsx): workspace shell, live status, runtime map,
  navigation, safety principles, and roadmap.
- [App.css](../apps/web/src/App.css) and [index.css](../apps/web/src/index.css):
  responsive layout, design tokens, contrast, focus, and reduced-motion styling.
- [Icon.tsx](../apps/web/src/Icon.tsx): lightweight inline SVG icons; no new dependency or
  external asset request.
- [RequestLab.tsx](../apps/web/src/RequestLab.tsx): synthetic request interaction, inline
  feedback, actual response display, and reset.
- [api.ts](../apps/web/src/api.ts): shared UI error-message helper; API contracts and
  request semantics are unchanged.
- [App.test.tsx](../apps/web/src/App.test.tsx) and
  [smoke.spec.mjs](../tests/e2e/smoke.spec.mjs): focused UX regressions and six-width
  browser checks.
- [README.md](../README.md), [PLAN.md](PLAN.md), and [VERIFICATION.md](VERIFICATION.md):
  usage, progress, and observed outcomes.

## Art-directed revision - 2026-11-12

The user requested a substantially more expressive, Awwwards-style experience rather than
another dashboard refinement. The resulting design and procedural artwork are original; no
Awwwards site was copied and no award/affiliation claim is made. The earlier UI ledger is
historical. This revision replaces its sidebar/card layout while preserving the diagnostic
API and request UX.

### Implemented and observed

- A paper/ink/electric-lime visual direction, oversized Syne/serif headlines, bundled
  Manrope body type, restrained entrance motion, an animated type ribbon, distinct
  editorial/live-lab sections, and a large typographic footer.
- An original interactive Three.js sculpture: pointer response, accessible rotate control,
  global pause, OS reduced-motion handling, and a visible static fallback if WebGL is
  unavailable or its context is lost.
- The initial API check settles before renderer initialization. Two generated 192 x 192
  studio-lighting textures avoid real-time environment convolution. Rendering is capped at
  24 FPS and 1.25 device-pixel ratio; intersection and visibility observers stop
  scheduling work offscreen/in hidden tabs. Geometry, textures, renderer, observers, and
  listeners are disposed on unmount.
- Existing validation, synthetic consent, JSON inspection, reset, real PostgreSQL-backed
  status, and safe error handling remain operational.

| Check                         | Observed result                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Locked dependency restoration | `npm ci` passed; 118 packages restored                                                  |
| Prettier / Oxlint             | Passed; zero lint warnings/errors                                                       |
| Unit tests                    | 10 passed                                                                               |
| TypeScript / Vite build       | Passed                                                                                  |
| Chromium/API suite            | 16 passed, zero retries                                                                 |
| Reflow/navigation             | 320, 390, 768, 1024, 1280, 1440 CSS pixels passed with no document overflow             |
| Original 3D rendering         | Actual WebGL renderer initialized; rotating a paused sculpture changed its canvas image |
| Reduced motion                | Starts paused; animated ribbon disabled; explicit rotation still works                  |
| No-WebGL failure path         | Visible static fallback; the real synthetic request still succeeds                      |
| High-density display          | At device ratio 2, actual canvas dimensions did not exceed 1.25 x CSS size              |
| Asset privacy                 | Actual font and renderer requests remained same-origin; both bundled fonts loaded       |
| Visual inspection             | Desktop hero/full-page and mobile screenshots inspected                                 |
| Backend / hosted CI           | Unchanged / not rerun                                                                   |

### Failures fixed, not hidden

1. The new Fontsource versions did not provide the assumed `latin.css` entry point.
   Inspection of the installed packages identified their actual WOFF2 files; explicit
   local `@font-face` declarations fixed the build.
2. The first physical-lighting/environment-convolution implementation delayed the main
   thread enough to fail the 768 px API-status smoke assertion. The renderer was replaced
   with lightweight procedural matcap studio lighting, and API initialization now precedes
   decorative rendering. The same timeouts were retained; all browser cases subsequently
   passed.
3. A focused rendered-text contrast check found several weak caption colors. Those colors
   were darkened without changing layout or hiding text.

Vite reports a non-fatal warning because the optional renderer chunk is 531.69 kB minified
(131.98 kB gzip). It is already dynamically imported rather than included in the core UI
chunk. The warning was not suppressed. The main UI is 250.96 kB minified (77.35 kB gzip),
and the two local font files total 59.43 kB. These are observed build artifact sizes, not
performance benchmarks. No browser/GPU compatibility or accessibility certification is
claimed.

### Exact local commands

The final focused contrast probe checked 127 visible text elements against solid
backgrounds, with no failures at its normal/large-text thresholds. Decorative artwork,
disabled controls, and the large decorative chapter numeral were excluded; this is not a
full accessibility audit.

After the color-only refinement, a repeat full browser run completed its UI assertions but
reported browser-context teardown timeouts for the 390 px and 768 px cases (14 passed, 2
teardown failures). Those exact two cases were rerun unchanged and both passed, including
teardown. No timeout was increased, test disabled, or application behavior bypassed. The
earlier clean 16-test run and these final focused results are distinct observations, not
one fabricated run. Runtime/isolation and Git whitespace checks also passed.

The focused recheck command was:

```powershell
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps smoke npm run test:e2e -- --grep '390px|768px'
```

```powershell
Set-Location 'C:\Users\upadhsah\Desktop\project\FirstWork'
docker compose -p firstwork -f infra\docker\compose.yaml --profile tools run --rm --no-deps web-check sh -c 'npm ci --no-audit --no-fund && npm run check'
docker compose -p firstwork -f infra\docker\compose.yaml up --detach --build --no-deps --wait --wait-timeout 90 web
.\scripts\firstwork.ps1 -Action Smoke
.\scripts\verify-runtime.ps1
```

Only FirstWork's web container is rebuilt. API/database services and the existing Compose
isolation/resource limits are retained.

### Changed files relative to the previous UI

- [App.tsx](../apps/web/src/App.tsx), [App.css](../apps/web/src/App.css), and
  [index.css](../apps/web/src/index.css): new editorial composition, navigation, readable
  visual hierarchy, live-system presentation, motion and typography.
- [Sculpture.tsx](../apps/web/src/Sculpture.tsx),
  [sculptureScene.ts](../apps/web/src/sculptureScene.ts), and
  [useReducedMotion.ts](../apps/web/src/useReducedMotion.ts): lazy optional 3D, procedural
  art, bounded rendering, controls, and fallback.
- [package.json](../apps/web/package.json) and [package-lock.json](../package-lock.json):
  pinned Three.js/types and local Manrope/Syne font dependencies.
- [licenses](../apps/web/public/licenses): original MIT and OFL redistribution notices
  copied from the installed packages.
- [App.test.tsx](../apps/web/src/App.test.tsx), [setup.ts](../apps/web/src/test/setup.ts),
  and [smoke.spec.mjs](../tests/e2e/smoke.spec.mjs): preserved functional tests and real
  browser checks for new 3D, motion, fallback, local fonts and render caps.
- [README.md](../README.md), [PLAN.md](PLAN.md), and this report: current behavior,
  observed validation, exact commands, and limitations.

## Remaining scope boundaries

Only a diagnostic skeleton is in scope. Authentication, tenant isolation, permissions,
audit records, retry/idempotency semantics, domain entities, onboarding decisions,
uploads, malware scanning, OCR, human review, events, agents, OpenTelemetry export, cloud
deployment, and benchmarking are not implemented or certified.

Wait for Phase 2 authorization. Resolve identity/roles/tenancy and audit ownership before
designing domain writes. Git initialization needs separate approval if it is desired.
