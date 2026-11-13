# FirstWork: Event-Driven Workforce Onboarding Engine

An original, local engineering prototype inspired by the public workforce onboarding
problem area. This project is not affiliated with FirstWork and does not use private
company systems, real employees, or real documents.

## Scope and current status

**Verified locally:** the current UI passes 15 frontend unit tests and 20 Chromium/API
browser tests, plus formatting, lint, type checking, and production build. Two of three
full browser runs passed cleanly; one had a single browser-teardown timeout that did not
repeat. The unchanged API previously passed 20 Java tests. Runtime isolation was
rechecked; all three services are healthy. Hosted CI has not run.

This increment implements **Phase 0 (contract and safety) and Phase 1 (working skeleton)
only** from [the engineering guide](08_FirstWork_Onboarding.pdf). Implementation and
verification status are tracked in [the plan](docs/PLAN.md).

The Phase 1 slice is a React/TypeScript single-page experience, a Java 21/Spring Boot 3
API, PostgreSQL, a Flyway bootstrap migration, health endpoints, and a non-persistent
synthetic request-validation form.

### Immersive experience

- A full-viewport WebGL scene of about 28,000 particles that reshapes itself as you
  scroll: a sphere, scattered noise, a stack of documents, a three-node network, orbit
  rings, and an asterisk. The network colours follow the latest real system check.
- An opening curtain whose count follows real readiness (fonts, the system check, the
  scene) and always lifts within a few seconds.
- Oversized Syne and Instrument Serif headlines that slide in, a statement that lights up
  word by word, a moving type band, a pinned horizontal chapter, and stacking roadmap
  cards. Everything follows native scrolling; nothing takes over the scroll wheel.
- A cursor follower and magnetic buttons for precise pointers only.
- Database-backed status with a real check timestamp and browser-measured round trip,
  visible failures, and manual refresh.
- A synthetic request lab with inline validation, consent, a live JSON preview, actual
  response inspection, and a reset that clears the result and consent.
- Locally bundled Manrope, Syne, and Instrument Serif fonts; no remote font, image, or
  script service.

**Motion and performance.** The scene steps its resolution and particle count down on
slower devices. On a software renderer, or a device too slow to animate it, the scene
holds still and redraws only when the chapter changes, so the page stays responsive. The
"Motion" control pauses all decorative movement, and the operating system's reduced-motion
setting skips the curtain, the pinning, and every animation. Without WebGL the page shows
a static backdrop and the lab still works. The scene code is a separate, lazily loaded
chunk. Original third-party notices are in the
[licenses folder](apps/web/public/licenses).

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

The containers have no restart policy, so they stay stopped after Docker Desktop restarts
and the dashboard refuses connections until they are started again. Bring them back,
without re-running the checks, with:

```powershell
docker compose -p firstwork -f infra\docker\compose.yaml up --detach --wait db api web
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
