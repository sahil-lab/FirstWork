import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, fetchSystem, type SystemStatus } from "./api";
import { Cursor } from "./Cursor";
import { Icon } from "./Icon";
import { useActiveSection, useMagnetic, usePageMotion, useReducedMotion } from "./motion";
import { Preloader } from "./Preloader";
import { RequestLab } from "./RequestLab";
import { SceneCanvas, type SceneState } from "./SceneCanvas";
import "./App.css";

type SystemState =
  | { kind: "loading" }
  | { kind: "ready"; system: SystemStatus; checkedAt: Date; roundTripMs: number }
  | { kind: "error"; message: string };

const navigation = [
  { id: "overview", label: "Vision" },
  { id: "system-health", label: "System" },
  { id: "request-lab", label: "Lab" },
  { id: "build-roadmap", label: "Roadmap" },
] as const;

const statementWords =
  "Manual onboarding, repeated document checks and shifting compliance rules keep good people waiting. We think a first day deserves better: clear rules, careful automation, and a human making every call that matters."
    .split(" ")
    .map((word, position) => ({ id: `${position}-${word}`, word }));

const principles = [
  {
    number: "01",
    tone: "ink",
    title: "Synthetic only.",
    body: "Every input here is invented. No real names, documents or employee details, by design rather than by promise.",
    tag: "Guardrail, today",
  },
  {
    number: "02",
    tone: "acid",
    title: "Show the real state.",
    body: "Status comes from a live API reading a migrated database. When a check fails, the page says so.",
    tag: "Testable below",
  },
  {
    number: "03",
    tone: "ink",
    title: "A human decides.",
    body: "No automated adverse employment decisions. Review workflows are future work, and they stay human-led.",
    tag: "A boundary, not a feature",
  },
  {
    number: "04",
    tone: "paper",
    title: "Say what's missing.",
    body: "Workers, documents, rules and events are not built yet. The roadmap marks each of them as planned.",
    tag: "Honest scope",
  },
] as const;

const phases = [
  {
    index: "00",
    tag: "Defined",
    title: "Contract & safety",
    body: "Requirements, architecture, a threat model and human-approval boundaries, written before a line of product code.",
    current: false,
  },
  {
    index: "01",
    tag: "You're here",
    title: "Working foundation",
    body: "A real local stack: health checks, migrations, strict request validation and browser-tested flows. The lab above is this phase.",
    current: true,
  },
  {
    index: "02",
    tag: "Planned",
    title: "Core workflows",
    body: "Worker records, permissions, audited state transitions and idempotent writes. Not implemented.",
    current: false,
  },
  {
    index: "03",
    tag: "Planned",
    title: "Verification engine",
    body: "Document checks, versioned rules and human review queues. Not implemented: no uploads, OCR or AI decisions exist here.",
    current: false,
  },
] as const;

const sectionIds = navigation.map((item) => item.id);

function Asterisk() {
  return (
    <svg className="asterisk" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M50 3v94M3 50h94M17 17l66 66m0-66L17 83"
        stroke="currentColor"
        strokeWidth="17"
      />
    </svg>
  );
}

function RuntimePanel({ state, refresh }: { state: SystemState; refresh: () => void }) {
  const connected = state.kind === "ready";
  return (
    <div className="runtime-panel">
      <div className="runtime-title">
        <span className="label">01 / The connection</span>
        <button
          className="refresh-control"
          type="button"
          onClick={refresh}
          disabled={state.kind === "loading"}
        >
          <Icon name="refresh" className={state.kind === "loading" ? "spinning" : ""} />
          Refresh status
        </button>
      </div>

      <svg
        className="signal"
        viewBox="0 0 320 44"
        data-state={state.kind}
        aria-hidden="true"
      >
        <path className="signal-path" d="M22 22H298" />
        <path className="signal-flow" d="M22 22H298" />
        <circle className="signal-node is-origin" cx="22" cy="22" r="8" />
        <circle className="signal-node" cx="160" cy="22" r="8" />
        <circle className="signal-node" cx="298" cy="22" r="8" />
      </svg>

      <h3>
        Real connections. <em>Zero make-believe.</em>
      </h3>
      <p className="runtime-description">
        Not a mockup behind the curtain. This page talks to a real Java API and a migrated
        PostgreSQL database.
      </p>

      {state.kind === "loading" && (
        <p className="connection-message loading-message" role="status">
          <span className="signal-dot" />
          Checking API and database...
        </p>
      )}
      {state.kind === "error" && (
        <div className="connection-message error" role="alert">
          <Icon name="info" />
          <div>
            <strong>System check failed.</strong>
            <p>{state.message}</p>
            <p>Confirm the local stack is running, then refresh status.</p>
          </div>
        </div>
      )}
      {connected && (
        <p className="connection-message connected-message" role="status">
          <span className="signal-dot" />
          API and database connected
        </p>
      )}

      <div className="service-list">
        <div className="service-row">
          <span className="service-index">01</span>
          <Icon name="globe" />
          <div>
            <h4>The interface</h4>
            <p>React + TypeScript</p>
          </div>
          <span className="service-state is-connected">
            You're here <Icon name="check" />
          </span>
        </div>
        <div className="service-row">
          <span className="service-index">02</span>
          <Icon name="server" />
          <div>
            <h4>The engine</h4>
            <p>{connected ? state.system.service : "Java 21 + Spring Boot"}</p>
          </div>
          <span className={`service-state ${connected ? "is-connected" : ""}`}>
            {connected
              ? "Responding"
              : state.kind === "loading"
                ? "Checking"
                : "Unavailable"}
            <Icon name={connected ? "check" : "activity"} />
          </span>
        </div>
        <div className="service-row">
          <span className="service-index">03</span>
          <Icon name="database" />
          <div>
            <h4>The foundation</h4>
            <p>PostgreSQL / private network</p>
          </div>
          <span className={`service-state ${connected ? "is-connected" : ""}`}>
            {connected ? "Reachable" : "Not yet verified"}
            <Icon name={connected ? "check" : "lock"} />
          </span>
        </div>
      </div>

      <div className="runtime-footnote">
        <span>
          Schema <code>{connected ? state.system.schemaVersion : "Not verified"}</code>
        </span>
        {connected ? (
          <>
            <span>
              Round trip <strong>{state.roundTripMs} ms</strong>
            </span>
            <span>
              Last check{" "}
              <time dateTime={state.checkedAt.toISOString()}>
                {state.checkedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </span>
          </>
        ) : (
          <span>Waiting for a successful check</span>
        )}
      </div>

      <details className="connection-details">
        <summary>
          Look under the hood <Icon name="chevron" />
        </summary>
        <dl>
          <div>
            <dt>System</dt>
            <dd>
              <a href="/api/v1/system" target="_blank" rel="noreferrer">
                GET /api/v1/system <Icon name="external" />
              </a>
            </dd>
          </div>
          <div>
            <dt>Readiness</dt>
            <dd>
              <a href="/actuator/health/readiness" target="_blank" rel="noreferrer">
                Open readiness check <Icon name="external" />
              </a>
            </dd>
          </div>
          <div>
            <dt>Monitoring</dt>
            <dd>
              Manual refresh, not continuous. Round trip is measured in this browser.
            </dd>
          </div>
        </dl>
      </details>

      <div className="lab-boundary">
        <Icon name="shield" />
        <p>
          Real infrastructure. <strong>Synthetic inputs only.</strong> No worker records.
          No employment decisions.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [systemState, setSystemState] = useState<SystemState>({ kind: "loading" });
  const [initialCheckFinished, setInitialCheckFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const activeSection = useActiveSection(sectionIds, "overview");
  const [paused, setPaused] = useState(false);
  const [sceneState, setSceneState] = useState<SceneState>("loading");
  const [fontsReady, setFontsReady] = useState(
    () => typeof document.fonts === "undefined" || document.fonts.status === "loaded",
  );
  const [introStarted, setIntroStarted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const reducedMotion = useReducedMotion();
  const motionPaused = paused || reducedMotion;
  const headerMagnet = useMagnetic<HTMLAnchorElement>(!motionPaused);
  const heroMagnet = useMagnetic<HTMLAnchorElement>(!motionPaused);
  const outroMagnet = useMagnetic<HTMLAnchorElement>(!motionPaused);
  const revealIntro = useCallback(() => setIntroStarted(true), []);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  usePageMotion(rootRef, reducedMotion);

  useEffect(() => {
    const controller = new AbortController();
    const started = performance.now();
    fetchSystem(controller.signal).then(
      (system) => {
        if (controller.signal.aborted) return;
        setSystemState({
          kind: "ready",
          system,
          checkedAt: new Date(),
          roundTripMs: Math.max(1, Math.round(performance.now() - started)),
        });
        setInitialCheckFinished(true);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setSystemState({ kind: "error", message: apiErrorMessage(error) });
        setInitialCheckFinished(true);
      },
    );
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sceneStatus =
    systemState.kind === "ready"
      ? "connected"
      : systemState.kind === "error"
        ? "failed"
        : "checking";
  const sceneNote =
    sceneState === "unavailable"
      ? "Interactive scene unavailable. Showing a static backdrop."
      : sceneState === "loading"
        ? "Preparing the interactive scene."
        : sceneState === "still"
          ? "Low-power rendering. The scene holds still."
          : motionPaused
            ? "Motion paused. The scene holds still."
            : "Rendered live in your browser. Move your cursor.";
  const stackLabel =
    systemState.kind === "ready"
      ? "Live"
      : systemState.kind === "error"
        ? "Offline"
        : "Checking";

  return (
    <div
      className="experience"
      ref={rootRef}
      data-motion={motionPaused ? "paused" : "playing"}
      data-reduced={reducedMotion}
      data-intro={reducedMotion || introStarted ? "in" : "pending"}
    >
      <SceneCanvas
        paused={motionPaused}
        started={reducedMotion || introStarted}
        status={sceneStatus}
        state={sceneState}
        onState={setSceneState}
      />
      {!reducedMotion && !introDone && (
        <Preloader
          steps={[fontsReady, initialCheckFinished, sceneState !== "loading"]}
          onReveal={revealIntro}
          onDone={finishIntro}
        />
      )}
      <Cursor enabled={!motionPaused} />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <a className="wordmark" href="#overview" aria-label="FirstWork home">
          <Asterisk />
          <span>firstwork</span>
        </a>
        <nav aria-label="Workspace navigation">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={activeSection === item.id ? "location" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="motion-control"
            type="button"
            aria-label="Pause motion"
            aria-pressed={motionPaused}
            disabled={reducedMotion}
            onClick={() => setPaused((value) => !value)}
          >
            <span className="motion-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {motionPaused ? "Motion off" : "Motion on"}
          </button>
          <a className="header-cta" href="#request-lab" ref={headerMagnet}>
            Enter the lab <Icon name="external" />
          </a>
        </div>
        <span className="scroll-meter" aria-hidden="true" />
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          className="hero anchor-section"
          id="overview"
          data-scene="0"
          aria-labelledby="page-title"
          tabIndex={-1}
        >
          <div className="hero-meta intro-fade">
            <span className="label">
              <span className="signal-dot" />
              Independent prototype / Phase 01
            </span>
            <span className="label">Local build / Synthetic data only</span>
          </div>
          <h1 className="hero-title" id="page-title">
            <span className="line">
              <span>Paperwork,</span>
            </span>{" "}
            <span className="line">
              <span>
                <span className="hero-into">into </span>
                <em>possibility.</em>
              </span>
            </span>
          </h1>
          <div className="hero-foot intro-fade">
            <p className="hero-lead">
              An independent engineering prototype for calmer worker onboarding. No real
              employee data. The live stack below runs on synthetic input only.
            </p>
            <a className="pill-cta" href="#request-lab" ref={heroMagnet}>
              <span>Enter the live lab</span>
              <span className="pill-disc">
                <Icon name="external" />
              </span>
            </a>
            <div className="hero-aside">
              <p className="stack-chip" data-state={systemState.kind} aria-hidden="true">
                <span className="signal-dot" />
                Local stack <strong>{stackLabel}</strong>
              </p>
              <p className="scene-note">{sceneNote}</p>
            </div>
          </div>
        </section>

        <section
          className="manifesto anchor-section"
          id="manifesto"
          data-scene="1"
          aria-labelledby="manifesto-label"
          tabIndex={-1}
        >
          <h2 className="label section-label" id="manifesto-label">
            01 / Why this exists
          </h2>
          <p className="statement" data-lit>
            {statementWords.map(({ id, word }) => (
              <span className="lit-word" key={id}>
                {word}{" "}
              </span>
            ))}
          </p>
          <div className="manifesto-notes" data-reveal="fade">
            <div>
              <h3>What this is</h3>
              <p>
                A working local skeleton: a web interface, a Java API and a migrated
                PostgreSQL database, tested end to end.
              </p>
            </div>
            <div>
              <h3>What it is not</h3>
              <p>
                An employment system. There are no uploads, no document checks and no
                automated decisions about people.
              </p>
            </div>
          </div>
        </section>

        <div className="tape" aria-hidden="true">
          <div className="tape-track">
            {["first", "second"].map((copy) => (
              <span className="tape-copy" key={copy}>
                Less friction <Asterisk /> <strong>More possibility</strong> <Asterisk />{" "}
                People first <Asterisk />
              </span>
            ))}
          </div>
        </div>

        <section
          className="principles anchor-section"
          id="safety"
          data-scene="2"
          data-pin
          aria-labelledby="principles-heading"
          tabIndex={-1}
        >
          <div className="pin-stage" data-pin-stage>
            <div className="principles-head">
              <p className="label section-label">02 / Ground rules</p>
              <h2 id="principles-heading" data-reveal>
                <span className="line">
                  <span>Guardrails first.</span>
                </span>{" "}
                <span className="line">
                  <span>
                    <em>Features second.</em>
                  </span>
                </span>
              </h2>
            </div>
            <ul className="pin-track" data-pin-track>
              {principles.map((principle) => (
                <li
                  className={`principle-card tone-${principle.tone}`}
                  key={principle.number}
                >
                  <span className="card-number">{principle.number}</span>
                  <h3>{principle.title}</h3>
                  <p>{principle.body}</p>
                  <span className="card-tag">{principle.tag}</span>
                </li>
              ))}
              <li className="principle-card tone-cta">
                <a href="#system-health">
                  <span>Now watch it run</span>
                  <Icon name="arrow" />
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="live anchor-section"
          id="system-health"
          data-scene="3"
          aria-labelledby="live-heading"
          tabIndex={-1}
        >
          <div className="section-wrap">
            <div className="live-head">
              <div>
                <p className="label section-label">
                  <span className="signal-dot" />
                  03 / Live engineering
                </p>
                <h2 id="live-heading" data-reveal>
                  <span className="line">
                    <span>Proof,</span>
                  </span>{" "}
                  <span className="line">
                    <span>
                      <em>not promises.</em>
                    </span>
                  </span>
                </h2>
              </div>
              <p className="live-lead" data-reveal="fade">
                Everything below is real: a Java 21 API, a migrated PostgreSQL database
                and a request you can run yourself.
              </p>
            </div>
            <div className="live-grid">
              <RuntimePanel
                state={systemState}
                refresh={() => {
                  setSystemState({ kind: "loading" });
                  setAttempt((value) => value + 1);
                }}
              />
              <RequestLab />
            </div>
            <div className="live-foot">
              <span>Java 21 / Spring Boot / PostgreSQL / React</span>
              <span>Local by design. Honest by default.</span>
            </div>
          </div>
        </section>

        <section
          className="roadmap anchor-section"
          id="build-roadmap"
          data-scene="4"
          aria-labelledby="roadmap-heading"
          tabIndex={-1}
        >
          <div className="roadmap-layout">
            <div className="roadmap-intro">
              <p className="label section-label">04 / The road ahead</p>
              <h2 id="roadmap-heading" data-reveal>
                <span className="line">
                  <span>Good things,</span>
                </span>{" "}
                <span className="line">
                  <span>
                    <em>built deliberately.</em>
                  </span>
                </span>
              </h2>
              <p>
                No shortcuts to a meaningful first day. Here is where the build stands,
                and where it does not.
              </p>
              <a className="text-link" href="#request-lab">
                Explore what's working <Icon name="arrow" />
              </a>
            </div>
            <ol className="phase-stack">
              {phases.map((phase) => (
                <li
                  className={phase.current ? "phase-card is-current" : "phase-card"}
                  key={phase.index}
                >
                  <div className="phase-top">
                    <span className="phase-index">Phase {phase.index}</span>
                    <span className="phase-tag">{phase.tag}</span>
                  </div>
                  <h3>{phase.title}</h3>
                  <p>{phase.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <p className="roadmap-disclaimer">
            Later phases, workflow events, AI and deployment are unimplemented. This is a
            local engineering prototype, not an employment system.
          </p>
        </section>

        <section className="outro" data-scene="5" aria-labelledby="outro-heading">
          <p className="label section-label">05 / Try it yourself</p>
          <h2 id="outro-heading" data-reveal>
            <span className="line">
              <span>Here's to a better</span>
            </span>{" "}
            <span className="line">
              <span>
                <em>first impression.</em>
              </span>
            </span>
          </h2>
          <a className="orb-link" href="#request-lab" ref={outroMagnet}>
            <span>Run the lab</span>
            <Icon name="arrow" />
          </a>
        </section>

        <footer className="site-footer">
          <a
            className="footer-wordmark"
            href="#overview"
            aria-label="FirstWork, back to top"
          >
            firstwork
            <Asterisk />
          </a>
          <div className="footer-bottom">
            <span>Independent prototype / 2026</span>
            <p>
              Not affiliated with FirstWork. Synthetic data only. No real employee data or
              automated employment decisions.
            </p>
            <a href="#overview">Back to top ↑</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
