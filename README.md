# FirstWork: Event-Driven Workforce Onboarding Engine

An original, local engineering prototype inspired by the public workforce onboarding
problem area. This project is not affiliated with FirstWork and does not use private
company systems, real employees, or real documents.

## Scope and current status

**Verified locally:** the UI refresh passes 10 frontend tests, 16 Chromium/API smoke
tests, formatting, lint, type checking, and production build. The unchanged API previously
passed 20 Java tests. Runtime isolation was rechecked; all three services are healthy.
Hosted CI has not run.

This increment implements **Phase 0 (contract and safety) and Phase 1 (working skeleton)
only** from [the engineering guide](08_FirstWork_Onboarding.pdf). Implementation and
verification status are tracked in [the plan](docs/PLAN.md).

The Phase 1 slice is a React/TypeScript status dashboard, a Java 21/Spring Boot 3 API,
PostgreSQL, a Flyway bootstrap migration, health endpoints, and a non-persistent synthetic
request-validation form.

### Art-directed experience

- Oversized editorial typography, a paper/ink/electric-lime palette, a moving typographic
  ribbon, and distinct story, engineering, and roadmap sections.
- An original Three.js possibility-loop sculpture with pointer response, rotation, pause
  controls, reduced-motion support, and an explicit static fallback.
- Locally bundled Manrope and Syne variable fonts; no remote font or image service.
- Database-backed status with a real check timestamp, visible failures, and manual
  refresh.
- A synthetic request lab with inline validation, consent, a live JSON preview, actual
  response inspection, and a reset that clears the result and consent.
- Keyboard-accessible navigation and disclosures, reduced-motion support, readable
  typography, and mobile-friendly inputs.

The sculpture starts only after the initial API check settles. Rendering is capped at 24
FPS and 1.25 device-pixel ratio, and stops offscreen or in a hidden tab. The optional 3D
chunk is lazy-loaded; the request lab still works without WebGL. Original third-party
notices are included in the [licenses folder](apps/web/public/licenses).

The runtime display reports the latest response, not continuous monitoring. Planned
workflows are labeled as unimplemented; the redesign adds no domain features or fabricated
workforce metrics.

**Not implemented:** employee or case management, document uploads, OCR, rules, human
review, authentication/authorization, idempotent domain writes, events, Redis, Kafka,
agents, cloud deployment, or performance benchmarks. A successful smoke check is not an
onboarding decision or evidence of production readiness.

## Local operation

Docker Desktop must be running with Linux containers. No host Java, Maven, or Node upgrade
is required; build and test tooling runs in resource-limited containers. Host Node 14 is
not used.

From PowerShell in this project directory:

```powershell
.\scripts\firstwork.ps1 -Action Start
```

The command initializes an ignored local database secret if necessary, verifies the code,
builds the runtime images, starts the stack, and runs browser smoke tests. Detailed
commands and observed results are recorded in
[the verification report](docs/VERIFICATION.md).

| Resource                 | Address / boundary                                  |
| ------------------------ | --------------------------------------------------- |
| Dashboard                | `http://127.0.0.1:18108`                            |
| API                      | `http://127.0.0.1:18208`                            |
| API readiness            | `http://127.0.0.1:18208/actuator/health/readiness`  |
| PostgreSQL               | Private Compose network only; no host port          |
| Compose project          | `firstwork`                                         |
| Local generated material | `.local/`, ignored by Git and Docker build contexts |

Do not submit real worker information. The only input is a synthetic reference such as
`synthetic-demo`, with an explicit synthetic-only confirmation. Nothing submitted by this
form is persisted.

```powershell
.\scripts\firstwork.ps1 -Action Check
.\scripts\firstwork.ps1 -Action Smoke
.\scripts\firstwork.ps1 -Action Status
.\scripts\verify-runtime.ps1 -ExerciseDatabaseOutage
```

Stopping services is explicit and scoped to this project:

```powershell
.\scripts\firstwork.ps1 -Action Stop
```

This does not delete database volumes. Never globally prune Docker, remove other projects'
resources, or delete the local database secret while retaining its database volume. No Git
repository, commit, remote, or cloud resource is created by these commands.

## Engineering documents

- [Product requirements and acceptance criteria](docs/PRD.md)
- [Architecture, interfaces, and repository layout](docs/ARCHITECTURE.md)
- [Threat model and human-approval boundaries](docs/THREAT_MODEL.md)
- [Ordered implementation plan](docs/PLAN.md)
- [Architecture decisions and coding conventions](docs/DECISIONS.md)
- [OpenAPI contract](packages/contracts/openapi.yaml)

The complete product's happy path, review escalation, and audited decisions belong to
later phases. They are not represented by fabricated dashboard metrics or placeholder
success responses.
