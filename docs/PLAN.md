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

## UI enhancement - 2026-11-12

The requested visual enhancement is implemented without advancing beyond Phase 1. The
workspace now includes a responsive navigation shell, a forest/lime visual system, live
runtime architecture, timestamped connection status, an interactive JSON request/response
inspector, inline reference validation, reset behavior, and an explicitly deferred
roadmap.

Verification observed: Prettier passed; Oxlint reported zero warnings/errors; 10 frontend
tests, strict TypeScript, and the Vite production build passed. All 12 Chromium/API checks
passed, including navigation/reflow at 320, 390, 768, 1024, 1280, and 1440 CSS pixels,
keyboard interaction, error recovery, validation, JSON inspection, and reset.
Desktop/mobile screenshots were inspected. A focused text-contrast check passed after
refining the type scale and muted palette.

Only the FirstWork web container was rebuilt. API/database services, network boundaries,
ports, and resource limits were preserved and reverified. No new dependency,
backend/domain feature, cloud operation, or Git mutation was added. An existing clean Git
import was present at the start of this UI task; it was not created by this task. Details
are in [VERIFICATION.md](VERIFICATION.md).

## Art-directed revision - 2026-11-12

The user clarified that a refined dashboard did not meet the visual goal. The
sidebar/card-dashboard approach has therefore been replaced by an original, editorial
site: oversized display/serif typography, local variable fonts, a reactive lime-and-chrome
3D sculpture, a moving type ribbon, a dark live-engineering section, native roadmap
disclosures, and a full-width typographic footer.

The existing synthetic request lab and API contracts remain intact. The first API check
finishes before the decorative renderer starts. Procedural studio textures replace the
initially expensive lighting setup; rendering has explicit frame-rate/pixel-density caps
and stops when hidden or offscreen. Reduced motion and WebGL-unavailable behavior were
exercised in real Chromium.

Observed: 10 unit tests, 16 Chromium/API tests, six responsive widths, keyboard
navigation, real 3D rotation, reduced-motion behavior, local-only asset requests,
2x-display render-size caps, and static-fallback lab submission passed. Lint, TypeScript,
locked dependency restoration, and production build passed. A non-fatal optional 3D
chunk-size warning is recorded rather than suppressed. Desktop/mobile compositions were
visually inspected.

No Phase 2 implementation, backend/database changes, other-project changes, or Git
mutations were made. [VERIFICATION.md](VERIFICATION.md) contains failures observed, fixes,
exact commands, changed files, and limitations.

## Next step after this increment

Final follow-up: the contrast probe passed for 127 inspected text elements. A repeat
browser run encountered two context-teardown timeouts after successful UI assertions; both
exact cases passed when rerun unchanged. Runtime isolation and whitespace checks passed.
The full history is retained in the verification report rather than reporting an
uninterrupted clean run.

Wait for explicit authorization to start Phase 2. First resolve the
authentication/tenant/role model and audit ownership, then specify domain contracts,
persistence, idempotency, and state transitions. Do not begin with OCR, uploads, event
infrastructure, agents, or cloud provisioning.
