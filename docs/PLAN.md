# Ordered implementation plan

The entire three-page guide was read before implementation. This run is explicitly limited
to Phases 0 and 1. Later copy/paste prompts are roadmap instructions, not permission to
skip ahead.

## Phase gates

| Phase                             | Status                                                        | Exit evidence                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0 - Contract and safety           | Complete within authorization; Git deliberately uninitialized | PRD, architecture, threat model, decisions, README, ignore rules, local CI definition                                                    |
| 1 - Working skeleton              | Verified locally                                              | 20 Java tests, 7 frontend tests, 6 Chromium/API smoke tests; migrated PostgreSQL, healthy services, isolation and outage/recovery checks |
| 2 - Core data and APIs            | Not started / out of scope                                    | Domain entities, permissions, idempotency, transitions, integration tests                                                                |
| 3 - Functional engine             | Not started / out of scope                                    | Rules, secure documents, OCR, review queue, events                                                                                       |
| 4 - Agents and automation         | Not started / out of scope                                    | Explicit interfaces, limits, tracing, deterministic fallbacks                                                                            |
| 5 - Reliability and observability | Not started / out of scope                                    | Resilience tests, rate limits, telemetry, failure scenarios                                                                              |
| 6 - Evaluation and packaging      | Not started / out of scope                                    | Reproducible benchmarks, complete demo, deployment packaging                                                                             |

## Phase 0 sequence

1. Inspect only FirstWork and read every PDF page.
2. Verify Docker, available tools, repository state, and reserved ports.
3. Document requirements, architecture, safety, non-goals, and acceptance gates.
4. Add repository structure, conventions, ignore rules, and CI definition.
5. Record that Git initialization is withheld pending separate authorization.

## Phase 1 sequence

1. Scaffold React/TypeScript with supported container tooling.
2. Implement a Spring Boot API, a real PostgreSQL bootstrap migration, liveness,
   readiness, and a DB-backed read-only system endpoint.
3. Add strict synthetic request validation and uniform safe errors.
4. Connect the dashboard to the real endpoints and expose visible failures.
5. Wire limited, project-scoped Compose services and non-root runtime images.
6. Run formatters, Java verification, frontend checks/build, then browser smoke.
7. Test isolation and a scoped database outage/recovery without deleting data.
8. Fix in-scope failures, rerun affected checks, and record exact results.

Do not mark a gate complete based only on authored files, a successful image build, or an
unexecuted command.

## Observations and progress

- Initial inventory: only `08_FirstWork_Onboarding.pdf` (9,695 bytes).
- The guide has three pages; all were extracted and read.
- Docker server `29.4.1` and Compose `v5.1.3` are responsive with Linux containers.
- No existing `firstwork` containers were found.
- FirstWork is not a Git repository. No Git initialization is authorized.
- Host Java is not on PATH; host Node 14 will not be used.
- Cached tool containers report Node `22.23.4` and Java `21.0.9`.
- Initial listeners on reserved ports `18108` and `18208` were not found.
- Spotless and Maven verification passed: 20 tests, zero failures/errors/skips; Java 21
  compilation and executable JAR packaging succeeded.
- Prettier, zero-warning Oxlint, strict TypeScript checks, Vite production build, and
  seven frontend unit tests passed.
- All three runtime services became healthy. Six real Chromium/API smoke tests passed
  against the migrated PostgreSQL stack.
- Runtime inspection verified dedicated loopback bindings, no published DB port, an
  internal DB network, non-root/read-only services, dropped capabilities, and
  CPU/memory/PID limits for runtime and tool containers.
- The database pause test observed liveness `200/UP`, readiness `503/DOWN`, and system
  status `503/Database unavailable`. Unpausing restored all healthy results.
- Shared Docker default network pools were exhausted; only FirstWork's new frontend bridge
  received a collision-checked explicit test subnet. No other network or global daemon
  setting was changed.
- Bind-mounted frontend dependencies caused Vitest worker-startup timeouts; project-scoped
  dependency volumes fixed the issue without relaxing tests.
- Nginx temporary directories were moved to its bounded `/tmp` mount to preserve a
  read-only root filesystem.
- PowerShell forwarding was corrected so native `psql -c` arguments cannot bind
  accidentally to a helper parameter. The runtime script then passed.
- A Docker command interruption was followed by API/DB containers observed in exited
  state; only FirstWork was restarted. No global daemon action was taken.
- [VERIFICATION.md](VERIFICATION.md) records commands, observed evidence, fixes,
  changed-file inventory, and unverified hosted-CI/production boundaries.

## Next step after this increment

Wait for explicit authorization to start Phase 2. First resolve the
authentication/tenant/role model and audit ownership, then specify domain contracts,
persistence, idempotency, and state transitions. Do not begin with OCR, uploads, event
infrastructure, agents, or cloud provisioning.
