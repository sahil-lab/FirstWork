# FirstWork: Event-Driven Workforce Onboarding Engine

An original, local engineering prototype inspired by the public workforce onboarding
problem area. This project is not affiliated with FirstWork and does not use private
company systems, real employees, or real documents.

## Scope and current status

**Verified locally:** 20 Java tests, 7 frontend tests, 6 Chromium/API smoke tests,
formatting/lint/type checks/builds, runtime isolation, and database outage/recovery checks
passed. All three runtime services are healthy. Hosted CI has not run.

This increment implements **Phase 0 (contract and safety) and Phase 1 (working skeleton)
only** from [the engineering guide](08_FirstWork_Onboarding.pdf). Implementation and
verification status are tracked in [the plan](docs/PLAN.md).

The Phase 1 slice is a React/TypeScript status dashboard, a Java 21/Spring Boot 3 API,
PostgreSQL, a Flyway bootstrap migration, health endpoints, and a non-persistent synthetic
request-validation form.

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
commands and observed results will be recorded in
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
