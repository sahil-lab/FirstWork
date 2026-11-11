# Product requirements

## Mission

Manual onboarding, document checks, and changing compliance rules delay worker activation.
The eventual product is a configurable workflow engine combining deterministic rules,
document extraction, human review, and auditable decisions. This is an independent
prototype, not an official company specification.

## Users and stories

1. As a local developer, I can start an isolated stack using Docker without replacing host
   runtimes.
2. As an evaluator, I can distinguish a running web server from a healthy API and a
   migrated, reachable database.
3. As an evaluator, I can submit a clearly synthetic diagnostic request and see both
   acceptance and actionable validation failures.
4. As a future operations reviewer, I need uncertain or expired evidence routed to a
   human, with the actor, rule version, and timestamp recorded. This story is deferred;
   the skeleton must not pretend to implement it.

## Phase 0 requirements

- Read the entire three-page engineering guide.
- Define the architecture, interfaces, threat model, non-goals, conventions, measurable
  acceptance criteria, and ordered plan.
- Create the monorepo structure, ignore rules, and CI definition.
- Preserve the guide and all unrelated files.
- Do not initialize Git without separate approval. Repository structure and CI
  configuration can exist without a Git repository.

## Phase 1 functional requirements

- Java 21 and Spring Boot 3 API; React and TypeScript frontend; PostgreSQL state.
- Local Compose project `firstwork`, with only loopback web/API ports `18108`/`18208`; no
  published database port.
- Flyway versioned bootstrap migration with a single non-domain metadata row.
- Liveness independent of the database; readiness dependent on database health.
- A read-only system endpoint that reads the migrated metadata row.
- A non-persistent JSON validation endpoint with strict request types, required fields,
  unknown-field rejection, and a synthetic-only confirmation.
- An accessible dashboard displaying actual API results, not fake employee or workflow
  statistics. Network and API errors must be visible.
- Environment-based configuration and local file-mounted database credentials.
- Automated formatting, linting/type checking, compilation, unit tests, and browser smoke
  checks that exercise the web/API/database slice.

## Measurable acceptance criteria

| ID    | Check               | Required observation                                                                                                         |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P0-1  | Guide and contract  | All three pages read; scope and deferred phases explicit                                                                     |
| P0-2  | Safety              | Synthetic-only policy, no adverse employment decisions, approval boundaries documented                                       |
| P0-3  | Delivery guardrails | Ignore rules and CI definition exist; no unauthorized Git operation                                                          |
| P1-1  | Local startup       | Documented command exits successfully and all three runtime services are healthy                                             |
| P1-2  | Health              | Liveness and readiness return HTTP 200 with `status: UP` when dependencies work                                              |
| P1-3  | Persistence         | `GET /api/v1/system` returns `schemaVersion: phase-1` read from PostgreSQL                                                   |
| P1-4  | Validation success  | Synthetic validation returns HTTP 200, `accepted: true`, `persisted: false`                                                  |
| P1-5  | Validation failures | Missing, false, mistyped, unknown, malformed, or invalid-reference inputs return HTTP 400; wrong media type returns HTTP 415 |
| P1-6  | Browser             | Real browser displays migrated system status and submits the synthetic form successfully                                     |
| P1-7  | Failure visibility  | Browser displays an actionable error for failed API requests; no success-shaped fallback                                     |
| P1-8  | Quality             | Java formatting/tests/package, frontend formatting/Oxlint/typecheck/tests/build, and E2E tests pass                          |
| P1-9  | Isolation           | Only expected loopback bindings exist; database has none; every Compose service has CPU/memory/PID limits                    |
| P1-10 | Recovery            | A scoped database interruption makes readiness and the DB-backed endpoint fail; recovery restores real success               |
| P1-11 | Reproducibility     | Locked npm dependencies, exact commands, observed results, and remaining limitations are documented                          |

These are functional assertions, not performance targets. No throughput, latency,
accuracy, benchmark, or production-readiness claim is made.

## Non-goals and later interfaces

Phase 2 owns workers, documents, extracted fields, verification cases, rulesets, workflow
events, permissions, retry/idempotency semantics, and state transitions. The guide's
routes (`POST /workers`, `POST /workers/{id}/documents`, `GET /cases`,
`POST /cases/{id}/review`) are **future contracts**, not implemented endpoints.

Phase 3 owns rules, encrypted document storage, malware scanning, OCR confidence, review
queues, and justified workflow events. Phases 4-6 own optional agents,
resilience/telemetry expansion, benchmarking, demo recording, and packaging.

No real data, external integrations, cloud provisioning, automated adverse employment
decisions, or automatic activation of workers is permitted here.
