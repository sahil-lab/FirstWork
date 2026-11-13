import { useEffect, useRef, useState } from "react";

const MINIMUM_MS = 1100;
const MAXIMUM_MS = 3600;
const EXIT_MS = 1050;
const STEP_LABELS = ["Typefaces", "Live stack", "Scene"] as const;

interface PreloaderProps {
  /** Real readiness signals, in the same order as the labels. */
  steps: readonly boolean[];
  onReveal: () => void;
  onDone: () => void;
}

/**
 * Opening curtain. The count follows real readiness, holds briefly so the
 * reveal can play, and always lifts after a few seconds so it never traps the page.
 */
export function Preloader({ steps, onReveal, onDone }: PreloaderProps) {
  const counterRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef(steps);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    const started = performance.now();
    let previous = started;
    let shown = 0;
    let frame = 0;
    let exitTimer = 0;

    function tick(now: number) {
      const elapsed = now - started;
      const current = stepsRef.current;
      const complete = current.filter(Boolean).length / Math.max(1, current.length);
      const goal =
        elapsed >= MAXIMUM_MS
          ? 100
          : Math.min(complete * 100, elapsed >= MINIMUM_MS ? 100 : 94);
      shown += (goal - shown) * (1 - Math.exp(-(now - previous) / 140));
      previous = now;
      if (goal - shown < 0.6) shown = goal;
      // One fixed-width cell per digit keeps the count from jittering.
      const digits = String(Math.round(shown)).padStart(3, "0");
      const cells = counterRef.current?.children ?? [];
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        const digit = digits[index] ?? "0";
        if (cell && cell.textContent !== digit) cell.textContent = digit;
      }
      if (shown >= 100) {
        setExiting(true);
        onReveal();
        exitTimer = window.setTimeout(onDone, EXIT_MS);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
    };
  }, [onDone, onReveal]);

  return (
    <div className={exiting ? "preloader is-exiting" : "preloader"} aria-hidden="true">
      <div className="preloader-body">
        <div className="preloader-top">
          <span>firstwork</span>
          <span>Independent prototype / Phase 01</span>
        </div>
        <div className="preloader-count" ref={counterRef}>
          <span>0</span>
          <span>0</span>
          <span>0</span>
        </div>
        <ul className="preloader-steps">
          {STEP_LABELS.map((label, index) => (
            <li key={label} data-done={steps[index] ? "true" : "false"}>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
