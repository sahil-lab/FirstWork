# Threat model and safety contract

## Assets, actors, and trust boundaries

Assets are the host workspace, local database credentials, bootstrap metadata, build
dependencies, and truthful evaluation results. Real worker documents, employment
decisions, and production credentials are explicitly out of scope.

The browser is untrusted. HTTP requests cross into the API; only the API crosses into the
private database network. Tooling can write within the mounted FirstWork project and its
own caches, but never receives the Docker socket. The Docker administrator and anyone who
controls this local host are trusted; loopback binding is not a substitute for
authentication.

## Threats and required controls

| Threat                                      | Phase 1 control                                                                                         | Residual risk / later gate                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Real employee data entered into a prototype | Synthetic-only notices, fixed reference format, explicit confirmation, no uploads or domain persistence | Users must still follow policy; a prefix is not a PII detector                                           |
| Automated adverse employment decisions      | No rules, scoring, rejection, activation, or decision endpoints                                         | Later rules need reviewed compliance requirements and human oversight                                    |
| Unauthorized domain mutation                | No domain mutations exist in this phase                                                                 | Authentication, tenant isolation, authorization, and audit ownership are mandatory before Phase 2 writes |
| SQL injection                               | Fixed bootstrap metadata query with no user input                                                       | Parameterize all future domain queries                                                                   |
| Bad or surprising request bodies            | Bean Validation, strict JSON scalar types, unknown-property rejection, JSON-only endpoint               | Rate limits and broader abuse handling belong to later hardening                                         |
| Browser script / markup injection           | React text rendering, no raw HTML, same-origin requests, restrictive CSP and security headers           | No external scripts or assets are permitted                                                              |
| Credential leakage                          | Ignored, generated, file-mounted secrets; no payload logging; hidden health/error details               | Local Docker administrators can read mounted credentials                                                 |
| Accidental cross-project access             | Fixed Compose namespace, loopback-only dedicated ports, internal DB network, no Docker socket mounts    | Shared host resources remain shared; do not alter another project's containers                           |
| Resource exhaustion                         | CPU/memory/PID limits; bounded JVM heap; small diagnostic input and proxy body limit                    | Docker image storage and the shared daemon itself are not quota-isolated                                 |
| Supply-chain drift                          | npm lockfile, explicit package versions, documented image tags and observed versions                    | Image tags can move; future release packaging should pin reviewed digests                                |
| Misleading health / fabricated results      | DB-backed system endpoint, readiness includes DB, real browser tests, observed-result report            | No production, compliance, benchmark, or complete-workflow certification                                 |
| Destructive or remote operations            | No cloud, real data, Git initialization, commits, remotes, pushes, or volume deletion                   | Each requires explicit approval before action                                                            |

## Negative checks in this increment

- Missing, false, malformed, mistyped, unknown-field, or invalid-reference JSON is
  rejected; unsupported request media types are rejected.
- Unsupported domain routes are not implemented.
- Readiness is unhealthy when the database is unavailable; liveness remains a process
  check. The DB-backed endpoint must not return a fake schema result.
- Frontend API failures are rendered as errors, not empty success states.
- Container inspection verifies expected network bindings and resource limits.

This is a design threat model with targeted tests, **not** an independent penetration test
or exhaustive security audit. The broader QA/security prompt in the guide is a later-phase
activity and is not claimed complete.

## Human approval boundaries

Stop and request approval before real data access, external integrations, cloud spending,
cloud deployment, destructive database actions, credential rotation against a retained
volume, Git initialization, commits, remotes, or pushes. Never globally prune Docker or
stop another project. No existing user file may be overwritten to simplify setup.
