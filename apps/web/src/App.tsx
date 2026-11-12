import { useEffect, useState } from "react";
import { apiErrorMessage, fetchSystem, type SystemStatus } from "./api";
import { Icon } from "./Icon";
import { RequestLab } from "./RequestLab";
import { Sculpture } from "./Sculpture";
import { useReducedMotion } from "./useReducedMotion";
import "./App.css";

type SystemState =
  | { kind: "loading" }
  | { kind: "ready"; system: SystemStatus; checkedAt: Date }
  | { kind: "error"; message: string };

const navigation = [
  { id: "overview", label: "The idea" },
  { id: "system-health", label: "Live system" },
  { id: "request-lab", label: "Request lab" },
  { id: "build-roadmap", label: "What's next" },
] as const;

function currentSection() {
  return (
    navigation.find((item) => `#${item.id}` === window.location.hash)?.id ?? "overview"
  );
}

function Asterisk({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`asterisk ${className}`}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
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
        <span className="micro-label">01 / THE CONNECTION</span>
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
      <h3>
        Real connections.
        <br />
        <span>Zero make-believe.</span>
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
          <span className="service-state">
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
          SCHEMA <code>{connected ? state.system.schemaVersion : "Not verified"}</code>
        </span>
        {connected ? (
          <span>
            LAST CHECK{" "}
            <time dateTime={state.checkedAt.toISOString()}>
              {state.checkedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
          </span>
        ) : (
          <span>Waiting for a successful check</span>
        )}
      </div>
      <details className="connection-details">
        <summary>
          Look under the hood <Icon name="external" />
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
            <dd>Manual refresh, not continuous.</dd>
          </div>
        </dl>
      </details>
      <div className="lab-boundary">
        <Icon name="shield" />
        <p>
          Real infrastructure. <strong>Synthetic inputs only.</strong>
          <br />
          No worker records. No employment decisions.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [systemState, setSystemState] = useState<SystemState>({ kind: "loading" });
  const [initialCheckFinished, setInitialCheckFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [activeSection, setActiveSection] = useState(currentSection);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const motionPaused = paused || reducedMotion;

  useEffect(() => {
    const controller = new AbortController();
    fetchSystem(controller.signal).then(
      (system) => {
        if (!controller.signal.aborted) {
          setSystemState({ kind: "ready", system, checkedAt: new Date() });
          setInitialCheckFinished(true);
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setSystemState({ kind: "error", message: apiErrorMessage(error) });
          setInitialCheckFinished(true);
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const onHashChange = () => setActiveSection(currentSection());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="experience" data-motion={motionPaused ? "paused" : "playing"}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="#overview" aria-label="FirstWork home">
          <Asterisk />
          <span>
            firstwork<span className="wordmark-dot">.</span>
          </span>
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
          <a className="header-cta" href="#request-lab">
            Enter the lab <Icon name="external" />
          </a>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section
          className="hero anchor-section"
          id="overview"
          aria-labelledby="page-title"
          tabIndex={-1}
        >
          <div className="hero-topline">
            <span className="micro-label">
              <span className="signal-dot" />
              INDEPENDENT THINKING. BETTER BEGINNINGS.
            </span>
            <span className="micro-label hero-edition">LOCAL PROTOTYPE / VOL. 001</span>
          </div>
          <div className="hero-main">
            <div className="hero-copy">
              <h1 id="page-title">
                <span>Great work.</span>
                <span className="hero-serif">Better</span>
                <span>
                  beginnings<span className="hero-period">.</span>
                </span>
              </h1>
              <div className="hero-note">
                <span className="note-rule" />
                <p>
                  A first day should open a world of possibility.
                  <br />
                  Not a mountain of paperwork.
                </p>
              </div>
              <a className="hero-cta" href="#request-lab">
                <span>Experience the foundation</span>
                <span className="button-disc">
                  <Icon name="external" />
                </span>
              </a>
            </div>
            <Sculpture paused={motionPaused} canStart={initialCheckFinished} />
          </div>
          <div className="hero-bottom">
            <a href="#manifesto">
              <span className="scroll-arrow">↓</span>SCROLL TO DISCOVER
            </a>
            <p>
              Built for people.
              <br />
              <strong>Engineered with intention.</strong>
            </p>
            <span className="hero-stamp">
              <Icon name="shield" />
              SYNTHETIC DATA.
              <br />
              REAL POSSIBILITIES.
            </span>
          </div>
        </section>

        <div className="tape-window" aria-hidden="true">
          <div className="type-tape">
            <div className="tape-track">
              {[0, 1].map((index) => (
                <span className="tape-copy" key={index}>
                  LESS FRICTION <Asterisk /> MORE POSSIBILITY <Asterisk /> PEOPLE FIRST{" "}
                  <Asterisk />
                </span>
              ))}
            </div>
          </div>
        </div>

        <section
          className="manifesto section-wrap anchor-section"
          id="manifesto"
          aria-labelledby="manifesto-heading"
          tabIndex={-1}
        >
          <div className="section-eyebrow">
            <span className="micro-label">01 / A DIFFERENT START</span>
            <span className="micro-label">THE IDEA</span>
          </div>
          <div className="manifesto-heading">
            <h2 id="manifesto-heading">
              For the humans
              <br />
              behind the
              <br />
              <span className="serif-word">paperwork.</span>
              <Asterisk />
            </h2>
            <div>
              <p>
                Good onboarding isn't about getting through a checklist. It's about making
                room for what comes next.
              </p>
              <p>
                We're exploring a more thoughtful foundation: clear rules, considered
                automation, and people in control.
              </p>
              <span className="vision-label">
                <span />
                THE VISION, NOT A PRODUCTION CLAIM
              </span>
            </div>
          </div>
          <div className="principle-grid" id="safety">
            <article>
              <span className="principle-number">
                01<span>↗</span>
              </span>
              <h3>
                Trust isn't an
                <br />
                afterthought.
              </h3>
              <p>
                Start with synthetic data and clear boundaries. Build confidence before
                handling anything real.
              </p>
              <span className="principle-foot">OUR PRESENT-DAY GUARDRAIL</span>
            </article>
            <article>
              <span className="principle-number">
                02<span>↗</span>
              </span>
              <h3>
                Clarity over
                <br />
                guesswork.
              </h3>
              <p>
                Real status. Explicit failures. No fabricated worker metrics dressed up as
                a working product.
              </p>
              <span className="principle-foot">WHAT YOU CAN TEST BELOW</span>
            </article>
            <article>
              <span className="principle-number">
                03<span>↗</span>
              </span>
              <h3>
                A human.
                <br />
                Always.
              </h3>
              <p>
                No automated adverse employment decisions. Document review and onboarding
                workflows remain future work.
              </p>
              <span className="principle-foot">A BOUNDARY, NOT A FEATURE CLAIM</span>
            </article>
          </div>
        </section>

        <section
          className="engineering-section anchor-section"
          id="system-health"
          aria-labelledby="engineering-heading"
          tabIndex={-1}
        >
          <div className="section-wrap">
            <div className="section-eyebrow">
              <span className="micro-label">
                <span className="signal-dot" />
                02 / LIVE ENGINEERING
              </span>
              <span className="micro-label">PHASE 01 — WORKING SKELETON</span>
            </div>
            <div className="engineering-intro">
              <h2 id="engineering-heading">
                Not just a<br />
                <span className="serif-word">pretty interface.</span>
              </h2>
              <p>
                Pull up a chair. Make a request.
                <br />
                See what actually happens.
              </p>
            </div>
            <div className="engineering-grid">
              <RuntimePanel
                state={systemState}
                refresh={() => {
                  setSystemState({ kind: "loading" });
                  setAttempt((value) => value + 1);
                }}
              />
              <RequestLab />
            </div>
            <div className="engineering-bottom">
              <span>JAVA 21 / SPRING BOOT / POSTGRESQL / REACT</span>
              <span>LOCAL BY DESIGN. HONEST BY DEFAULT.</span>
            </div>
          </div>
        </section>

        <section
          className="roadmap-section section-wrap anchor-section"
          id="build-roadmap"
          aria-labelledby="roadmap-heading"
          tabIndex={-1}
        >
          <div className="section-eyebrow">
            <span className="micro-label">03 / ONE INTENTIONAL STEP AT A TIME</span>
            <span className="micro-label">THE ROAD AHEAD</span>
          </div>
          <div className="roadmap-layout">
            <div className="roadmap-copy">
              <span className="chapter-number">
                03<span>—</span>
              </span>
              <h2 id="roadmap-heading">
                Good things.
                <br />
                <span className="serif-word">Built deliberately.</span>
              </h2>
              <p>
                No shortcuts to a meaningful first day.
                <br />
                Here's where we are. And where we're not.
              </p>
              <a href="#request-lab" className="text-link">
                Explore what's working <Icon name="arrow" />
              </a>
            </div>
            <div className="roadmap-chapters">
              <details>
                <summary>
                  <span className="chapter-index">00</span>
                  <span>Contract &amp; safety</span>
                  <span className="chapter-tag">Defined</span>
                  <span className="chapter-plus">+</span>
                </summary>
                <p>
                  Requirements, architecture, and human-approval boundaries. The
                  foundation for an independent, synthetic-only prototype.
                </p>
              </details>
              <details open>
                <summary>
                  <span className="chapter-index">01</span>
                  <span>Working foundation</span>
                  <span className="chapter-tag current">You're here</span>
                  <span className="chapter-plus">+</span>
                </summary>
                <p>
                  A real local stack. Health checks. Migrations. Request validation. The
                  interactive lab above is the implemented slice.
                </p>
                <a href="#request-lab">
                  Try the request lab <Icon name="external" />
                </a>
              </details>
              <details>
                <summary>
                  <span className="chapter-index">02</span>
                  <span>Core workflows</span>
                  <span className="chapter-tag">Planned</span>
                  <span className="chapter-plus">+</span>
                </summary>
                <p>
                  Worker records, permissions, audited transitions, and idempotent writes.
                  Not implemented. Requires Phase 2 authorization.
                </p>
              </details>
              <details>
                <summary>
                  <span className="chapter-index">03</span>
                  <span>Verification engine</span>
                  <span className="chapter-tag">Planned</span>
                  <span className="chapter-plus">+</span>
                </summary>
                <p>
                  Document checks, versioned rules, and human review. Not implemented. No
                  uploads, OCR, or AI decisions are available here.
                </p>
              </details>
              <p className="roadmap-disclaimer">
                Later phases, workflow events, AI, and deployment are unimplemented. This
                is a local engineering prototype, not an employment system.
              </p>
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="footer-top">
            <p>
              Here's to a better
              <br />
              <span className="serif-word">first impression.</span>
            </p>
            <a href="#request-lab" aria-label="Experience the request lab">
              <Icon name="external" />
            </a>
          </div>
          <a
            className="footer-wordmark"
            href="#overview"
            aria-label="FirstWork back to top"
          >
            firstwork<span>✳</span>
          </a>
          <div className="footer-bottom">
            <span>INDEPENDENT PROTOTYPE / 2026</span>
            <p>
              Not affiliated with FirstWork. Synthetic data only.
              <br />
              No real employee data or automated employment decisions.
            </p>
            <a href="#overview">BACK TO TOP ↑</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
