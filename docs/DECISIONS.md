# Decisions and coding conventions

## Decisions

### D001 - Follow the guide's stack, only for the authorized slice

Use Java 21 / Spring Boot 3, React / TypeScript, PostgreSQL, and Docker Compose. The
project is greenfield; the only pre-existing file is the engineering PDF. Do not
substitute host runtimes or introduce unrelated cloud infrastructure.

### D002 - Demonstrate plumbing without implementing Phase 2

One read-only system endpoint queries a Flyway-created metadata table. A separate
synthetic-only endpoint demonstrates strict request validation without persisting input.
No workers, cases, decisions, permissions, or events are pretended to exist. An in-memory
fake DB would not satisfy the persistence acceptance criterion and is not used.

### D003 - Containerized, sequential, resource-limited verification

Use the existing supported Maven/Java 21 and Node 22 container families. Host Node 14 and
host Java installation are irrelevant. Test/build artifacts are created under FirstWork,
then copied into small runtime images. Building application artifacts in limited tool
containers bounds compiler/test memory and avoids an unconstrained compilation stage
inside the shared Docker builder.

Run checks sequentially. Do not create or select a global buildx builder, prune images,
mount the Docker socket, or alter other sessions.

### D004 - Same-origin frontend

Nginx serves the compiled dashboard and proxies only API and health routes to the API. No
permissive CORS policy is necessary. Browser code has no secret. Frontend state is derived
from live responses; unreachable dependencies surface an explicit error and a retry
control.

### D005 - Secrets and persistence

Generate a random local-only database password once with an exclusive file create. Mount
it through Compose secrets; never print or commit it. Keep the database on a
project-specific volume and private network. Do not delete or rotate credentials as an
automatic recovery measure.

### D006 - Local diagnostic access is not production authorization

Loopback-only access and non-persistent diagnostic routes are sufficient for this limited
synthetic skeleton. They are not an authentication system. Before any domain mutation or
real data handling, Phase 2 must establish permissions, identity, tenant isolation, audit
ownership, and idempotency.

### D007 - Git is deliberately not initialized

The guide requests repository setup and logical commits, but the user explicitly withheld
Git initialization for FirstWork. Create the monorepo files and CI definition only. No
branch, commit, remote, or push is created.

### D008 - Defer unjustified infrastructure and claims

No Redis, Kafka, worker runtime, cloud resources, OCR, external AI, or real data. No
benchmark numbers or claims of complete onboarding, security certification, regulatory
compliance, or production readiness.

## Coding conventions

### Local network allocation

The shared Docker daemon reported `all predefined address pools have been fully subnetted`
when creating FirstWork's frontend network. Assign only that new network the explicit
`198.18.108.0/28` local test subnet after checking for overlapping Docker networks and
host routes. Existing FirstWork backend/tooling networks are retained. No global
address-pool setting, other project's network, or host route is changed; no network is
pruned.

### Tool dependency storage

Frontend dependencies live in `firstwork_web-modules` and
`firstwork_web-workspace-modules` Docker volumes shared only with this project's tool and
smoke containers. Source, build outputs, lockfiles, and reports remain inside FirstWork.
This avoids repeatedly loading thousands of dependency files over a Windows bind mount;
the first bind-mounted Vitest run failed before any test executed with worker-startup
timeouts. Keep the ordinary test timeout and worker count rather than hiding the failure
with retries or longer timeouts.

- Java: Java 21, package `com.firstwork.prototype`, records for immutable HTTP DTOs,
  constructor injection, Bean Validation, Maven, Google Java Format via Spotless,
  JUnit/MockMvc tests.
- TypeScript: strict compiler settings, no `any` escape hatches, typed and runtime-checked
  API responses, React function components, accessible controls.
- Frontend/tooling/docs: Prettier; frontend code also passes Oxlint. Dependency manifests
  and generated npm lockfiles must agree.
- The current official Vite React/TypeScript scaffold supplies TypeScript 7, Oxlint, and
  bundler-aware TypeScript configuration. Keep that prior art instead of adding an
  incompatible TypeScript/ESLint pairing or replacing it with a generic `tsc --init`
  configuration; explicitly enable strict checking.
- Errors: explicit Problem Details on the API and visible frontend messages; do not
  swallow failures or replace errors with success-shaped defaults.
- Logging: structured application logs without raw bodies, SQL text, credentials,
  documents, or personal data.
- Tests: unit-test success and failure behavior; browser smoke against actual containers
  and PostgreSQL. Report only executed/observed results.
- Migrations: append new versions; no editing applied migrations or destructive rollback
  without approval.
- Files: keep authored files inside FirstWork; ASCII source by default and LF line
  endings; avoid unnecessary comments, abstractions, and placeholder APIs.
