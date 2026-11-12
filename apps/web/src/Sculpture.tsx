import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { SculptureScene } from "./sculptureScene";

export function Sculpture({ paused, canStart }: { paused: boolean; canStart: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SculptureScene | null>(null);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [angle, setAngle] = useState(1);

  useEffect(() => {
    pausedRef.current = paused;
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (!canStart) return;
    let cancelled = false;
    let scene: SculptureScene | undefined;
    function unavailable(error: unknown) {
      if (cancelled) return;
      console.warn(
        "FirstWork 3D artwork is unavailable; using the static illustration.",
        error,
      );
      setState("unavailable");
    }

    import("./sculptureScene")
      .then(({ createSculptureScene }) => {
        if (cancelled || !canvasRef.current) return;
        scene = createSculptureScene(canvasRef.current, pausedRef.current, () =>
          unavailable(new Error("WebGL context lost.")),
        );
        sceneRef.current = scene;
        setState("ready");
      })
      .catch(unavailable);

    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [canStart]);

  return (
    <figure
      className="sculpture"
      data-renderer={state === "ready" ? "webgl" : "static"}
      data-paused={paused}
    >
      <div className="art-coordinate coordinate-top" aria-hidden="true">
        FORM / 001 <span>FIRSTWORK / EXPERIMENT</span>
      </div>
      <div
        className="sculpture-stage"
        role="img"
        aria-label="An original lime-green sculptural loop with a polished silver orbit, representing new possibilities."
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const bounds = event.currentTarget.getBoundingClientRect();
          sceneRef.current?.setPointer(
            ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
            ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
          );
        }}
        onPointerLeave={() => sceneRef.current?.setPointer(0, 0)}
      >
        <div className="art-orbit orbit-one" aria-hidden="true" />
        <div className="art-orbit orbit-two" aria-hidden="true" />
        <div className="art-shadow" aria-hidden="true" />
        <svg className="static-sculpture" viewBox="0 0 600 600" aria-hidden="true">
          <defs>
            <linearGradient id="loop-lime" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f0ffab" />
              <stop offset=".35" stopColor="#c4ef47" />
              <stop offset=".7" stopColor="#5b7d16" />
              <stop offset="1" stopColor="#d8ff6c" />
            </linearGradient>
            <linearGradient id="loop-silver" x1="0" x2="1">
              <stop offset="0" stopColor="#6f7775" />
              <stop offset=".4" stopColor="#fff" />
              <stop offset=".65" stopColor="#555d58" />
              <stop offset="1" stopColor="#d8dcd5" />
            </linearGradient>
          </defs>
          <g
            transform="translate(300 280) rotate(-28)"
            fill="none"
            stroke="url(#loop-lime)"
            strokeWidth="62"
          >
            <ellipse rx="145" ry="81" transform="rotate(0)" />
            <ellipse rx="145" ry="81" transform="rotate(60)" />
            <ellipse rx="145" ry="81" transform="rotate(120)" />
          </g>
          <ellipse
            cx="300"
            cy="285"
            rx="219"
            ry="91"
            transform="rotate(-30 300 285)"
            fill="none"
            stroke="url(#loop-silver)"
            strokeWidth="8"
          />
          <circle cx="116" cy="159" r="23" fill="url(#loop-silver)" />
        </svg>
        <canvas ref={canvasRef} aria-hidden="true" />
        <span className="art-cross cross-top" aria-hidden="true">
          +
        </span>
        <span className="art-cross cross-bottom" aria-hidden="true">
          +
        </span>
      </div>
      <div className="art-sticker" aria-hidden="true">
        <span className="sticker-star">✳</span>
        <span>
          MADE FOR
          <br />
          <strong>what's next.</strong>
        </span>
      </div>
      <figcaption>
        <span>
          <span className="micro-label">THE POSSIBILITY LOOP</span>
          <span className="art-caption">A little room for a different perspective.</span>
        </span>
        <button
          type="button"
          className="art-rotate"
          disabled={state !== "ready"}
          aria-label="Rotate sculpture"
          onClick={() => {
            sceneRef.current?.turn();
            setAngle((value) => (value % 4) + 1);
          }}
        >
          <Icon name="refresh" />
          <span>Rotate</span>
        </button>
      </figcaption>
      <div className="art-state">
        {state === "loading" ? (
          <span>Preparing interactive artwork...</span>
        ) : state === "unavailable" ? (
          <span>3D artwork unavailable. Showing the static illustration.</span>
        ) : (
          <span>
            {paused ? "Motion paused" : "Move your cursor to explore"}{" "}
            <span aria-live="polite">/ Angle 0{angle}</span>
          </span>
        )}
      </div>
    </figure>
  );
}
