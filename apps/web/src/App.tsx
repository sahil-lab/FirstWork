import { useEffect, useState, type FormEvent } from "react";
import { fetchSystem, validateSandbox, type SystemStatus } from "./api";
import "./App.css";

type SystemState =
  | { kind: "loading" }
  | { kind: "ready"; system: SystemStatus }
  | { kind: "error"; message: string };

type FormState =
  | { kind: "idle" | "submitting" }
  | { kind: "accepted"; reference: string }
  | { kind: "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unexpected API error. Check the local stack and try again.";
}

export default function App() {
  const [systemState, setSystemState] = useState<SystemState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [reference, setReference] = useState("synthetic-demo");
  const [synthetic, setSynthetic] = useState(false);
  const [formState, setFormState] = useState<FormState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    fetchSystem(controller.signal).then(
      (system) => {
        if (!controller.signal.aborted) setSystemState({ kind: "ready", system });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setSystemState({ kind: "error", message: errorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState({ kind: "submitting" });
    try {
      const result = await validateSandbox(reference, synthetic);
      setFormState({ kind: "accepted", reference: result.reference });
    } catch (error) {
      setFormState({ kind: "error", message: errorMessage(error) });
    }
  }

  return (
    <div className="shell">
      <header className="masthead">
        <a className="brand" href="/" aria-label="FirstWork home">
          <span className="brand-mark" aria-hidden="true">
            FW
          </span>
          <span>
            FirstWork <small>Engineering prototype</small>
          </span>
        </a>
        <span className="local-badge">Local environment</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">WORKFORCE ONBOARDING / PHASE 01</p>
          <h1 id="page-title">A foundation for better onboarding.</h1>
          <p className="lede">
            Verify the local stack before building workflows. Live system checks, explicit
            boundaries, and synthetic data only.
          </p>
        </section>

        <aside className="safety-banner" aria-label="Prototype safety boundary">
          <strong>Independent prototype. Not an employment system.</strong>
          <span>
            No real employee data, document uploads, or automated employment decisions.
          </span>
        </aside>

        <div className="workspace">
          <section className="card" aria-labelledby="system-heading">
            <div className="card-heading">
              <div>
                <p className="eyebrow">01 / CONNECTION</p>
                <h2 id="system-heading">System status</h2>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={systemState.kind === "loading"}
                onClick={() => {
                  setSystemState({ kind: "loading" });
                  setAttempt((value) => value + 1);
                }}
              >
                Refresh status
              </button>
            </div>

            {systemState.kind === "loading" && (
              <p role="status">Checking API and database...</p>
            )}
            {systemState.kind === "error" && (
              <div role="alert" className="error">
                <strong>System check failed.</strong>
                <p>{systemState.message}</p>
                <p>Confirm the local stack is running, then refresh status.</p>
              </div>
            )}
            {systemState.kind === "ready" && (
              <>
                <p className="healthy" role="status">
                  API and database connected
                </p>
                <dl className="system-facts">
                  <div>
                    <dt>API service</dt>
                    <dd>{systemState.system.service}</dd>
                  </div>
                  <div>
                    <dt>Database</dt>
                    <dd>PostgreSQL reachable</dd>
                  </div>
                  <div>
                    <dt>Migrated schema</dt>
                    <dd>{systemState.system.schemaVersion}</dd>
                  </div>
                  <div>
                    <dt>Data policy</dt>
                    <dd>Synthetic only</dd>
                  </div>
                </dl>
                <p className="muted">
                  Schema status is read from PostgreSQL, not a placeholder.
                </p>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="validation-heading">
            <p className="eyebrow">02 / REQUEST CONTRACT</p>
            <h2 id="validation-heading">Try a synthetic request</h2>
            <p className="muted">
              Check server-side validation. This does not create a worker or store input.
            </p>
            <form onSubmit={submit}>
              <label htmlFor="reference">Synthetic reference</label>
              <input
                id="reference"
                value={reference}
                disabled={formState.kind === "submitting"}
                onChange={(event) => {
                  setReference(event.target.value);
                  setFormState({ kind: "idle" });
                }}
                required
                minLength={11}
                maxLength={64}
                pattern={"synthetic-[a-z0-9][a-z0-9\\-]{0,53}"}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="reference-help"
              />
              <p id="reference-help" className="help">
                Start with synthetic-. Use lowercase letters, digits, or hyphens; 11-64
                characters.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={synthetic}
                  disabled={formState.kind === "submitting"}
                  required
                  onChange={(event) => {
                    setSynthetic(event.target.checked);
                    setFormState({ kind: "idle" });
                  }}
                />
                I confirm this is synthetic data only.
              </label>
              <button
                type="submit"
                disabled={!synthetic || formState.kind === "submitting"}
              >
                {formState.kind === "submitting" ? "Validating..." : "Validate request"}
              </button>
              {formState.kind === "accepted" && (
                <p role="status" className="success">
                  Accepted: {formState.reference}. No data was persisted.
                </p>
              )}
              {formState.kind === "error" && (
                <p role="alert" className="error">
                  {formState.message}
                </p>
              )}
            </form>
          </section>
        </div>

        <section className="scope-note" aria-labelledby="scope-heading">
          <h2 id="scope-heading">Built now. Defined for later.</h2>
          <p>
            <strong>Phase 1:</strong> health checks, migrations, validation, and a tested
            local stack.
          </p>
          <p>
            <strong>Not implemented:</strong> workers, document checks, rules, human
            review, events, or AI.
          </p>
        </section>
      </main>
      <footer>
        No affiliation with FirstWork. No production-readiness or regulatory-compliance
        claim.
      </footer>
    </div>
  );
}
