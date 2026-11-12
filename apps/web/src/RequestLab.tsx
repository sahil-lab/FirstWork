import { useRef, useState, type FormEvent } from "react";
import { apiErrorMessage, validateSandbox, type ValidationResult } from "./api";
import { Icon } from "./Icon";

type FormState =
  | { kind: "idle" | "submitting" }
  | { kind: "accepted"; result: ValidationResult }
  | { kind: "error"; message: string };

const referencePattern = "^synthetic-[a-z0-9][a-z0-9\\-]{0,53}$";
const referenceMatcher = new RegExp(referencePattern);

export function RequestLab() {
  const [reference, setReference] = useState("synthetic-demo");
  const [synthetic, setSynthetic] = useState(false);
  const [touched, setTouched] = useState(false);
  const [formState, setFormState] = useState<FormState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceValid = referenceMatcher.test(reference);
  const showError = touched && !referenceValid;
  const submitting = formState.kind === "submitting";

  function reset() {
    setReference("synthetic-demo");
    setSynthetic(false);
    setTouched(false);
    setFormState({ kind: "idle" });
    inputRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState({ kind: "submitting" });
    try {
      const result = await validateSandbox(reference, synthetic);
      setFormState({ kind: "accepted", result });
    } catch (error) {
      setFormState({ kind: "error", message: apiErrorMessage(error) });
    }
  }

  return (
    <section
      className="panel request-lab anchor-section"
      id="request-lab"
      aria-labelledby="request-heading"
      tabIndex={-1}
    >
      <div className="panel-heading">
        <div className="heading-with-icon">
          <span className="icon-tile mint">
            <Icon name="code" />
          </span>
          <div>
            <p className="eyebrow">THE PLAYGROUND</p>
            <h2 id="request-heading">Try a synthetic request</h2>
          </div>
        </div>
        <span className="tiny-badge">Sandbox</span>
      </div>
      <p className="panel-description">
        A small request. A real response. Nothing stored.
      </p>
      <div className="endpoint">
        <span className="method">POST</span>
        <code>/api/v1/sandbox/validate</code>
        <Icon name="lock" />
      </div>

      <form onSubmit={submit}>
        <div className="field-heading">
          <label htmlFor="reference">Synthetic reference</label>
          <button
            className="text-button"
            type="button"
            onClick={reset}
            disabled={submitting}
            aria-label="Reset request"
          >
            <Icon name="reset" /> Reset
          </button>
        </div>
        <div className={`input-wrap ${showError ? "invalid" : ""}`}>
          <Icon name="terminal" />
          <input
            ref={inputRef}
            id="reference"
            value={reference}
            disabled={submitting}
            onBlur={() => setTouched(true)}
            onChange={(event) => {
              setReference(event.target.value);
              setFormState({ kind: "idle" });
            }}
            required
            minLength={11}
            maxLength={64}
            pattern={referencePattern}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={showError}
            aria-describedby={
              showError ? "reference-help reference-error" : "reference-help"
            }
          />
          <span className="input-count" aria-hidden="true">
            {reference.length}/64
          </span>
        </div>
        <p id="reference-help" className="field-help">
          Start with <code>synthetic-</code>. Lowercase letters, digits, or hyphens; 11-64
          characters.
        </p>
        {showError && (
          <p id="reference-error" className="field-error" role="alert">
            Enter a valid synthetic reference before continuing.
          </p>
        )}

        <label className={`consent ${synthetic ? "confirmed" : ""}`}>
          <input
            type="checkbox"
            checked={synthetic}
            disabled={submitting}
            required
            onChange={(event) => {
              setSynthetic(event.target.checked);
              setFormState({ kind: "idle" });
            }}
          />
          <span>
            <strong>I confirm this is synthetic data only.</strong>
            <span>No real names, employee details, or documents.</span>
          </span>
          <Icon name="shield" />
        </label>

        <button
          className="button primary submit-button"
          type="submit"
          disabled={!synthetic || !referenceValid || submitting}
        >
          <Icon
            name={submitting ? "refresh" : "arrow"}
            className={submitting ? "spinning" : ""}
          />
          {submitting ? "Validating..." : "Validate request"}
        </button>
        <p className="form-note">
          <Icon name="lock" /> Validation only. No worker is created.
        </p>

        {formState.kind === "accepted" && (
          <div className="result success">
            <span className="result-icon">
              <Icon name="check" />
            </span>
            <div>
              <p role="status">
                Accepted: {formState.result.reference}. No data was persisted.
              </p>
              <span>The API accepted your synthetic request.</span>
            </div>
          </div>
        )}
        {formState.kind === "error" && (
          <div className="result error" role="alert">
            <Icon name="info" />
            <div>
              <strong>Request not completed</strong>
              <p>{formState.message}</p>
            </div>
          </div>
        )}
      </form>

      <details className="payload-inspector" open>
        <summary>
          <span>
            <Icon name="code" /> Inspect JSON
          </span>
          <Icon name="chevron" />
        </summary>
        <div className="code-console">
          <div className="console-heading">
            <span>REQUEST PREVIEW</span>
            <span>Not sent automatically</span>
          </div>
          <pre aria-label="Request JSON">
            <code>{JSON.stringify({ reference, synthetic }, null, 2)}</code>
          </pre>
          {formState.kind === "accepted" && (
            <>
              <div className="console-heading response-heading">
                <span>ACTUAL RESPONSE</span>
                <span>200 OK</span>
              </div>
              <pre aria-label="Response JSON">
                <code>{JSON.stringify(formState.result, null, 2)}</code>
              </pre>
            </>
          )}
        </div>
      </details>
    </section>
  );
}
