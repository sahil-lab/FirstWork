import { useEffect, useRef } from "react";
import type { ExperienceScene, SceneStatus } from "./scene/experienceScene";
import { sceneProgress } from "./scene/progress";

/** "still" means the scene is drawn on demand because animating it would be too slow. */
export type SceneState = "loading" | "live" | "still" | "unavailable";

interface SceneCanvasProps {
  paused: boolean;
  started: boolean;
  status: SceneStatus;
  state: SceneState;
  onState: (state: SceneState) => void;
}

function measureProgress() {
  const anchors = [...document.querySelectorAll<HTMLElement>("[data-scene]")].map(
    (element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    },
  );
  return sceneProgress(anchors, window.innerHeight);
}

/** Full-viewport living backdrop. Decorative: the page works without it. */
export function SceneCanvas({
  paused,
  started,
  status,
  state,
  onState,
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ExperienceScene | null>(null);
  const pausedRef = useRef(paused);
  const startedRef = useRef(started);
  const statusRef = useRef(status);

  useEffect(() => {
    pausedRef.current = paused;
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    startedRef.current = started;
    sceneRef.current?.setStarted(started);
  }, [started]);

  useEffect(() => {
    statusRef.current = status;
    sceneRef.current?.setStatus(status);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    let scene: ExperienceScene | undefined;
    let frame = 0;

    function sync() {
      frame = 0;
      sceneRef.current?.setProgress(measureProgress());
    }

    function requestSync() {
      if (frame === 0) frame = requestAnimationFrame(sync);
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "mouse") {
        sceneRef.current?.setPointer(event.clientX, event.clientY);
      }
    }

    function unavailable(error: unknown) {
      if (cancelled) return;
      console.warn(
        "FirstWork interactive scene is unavailable; using the static backdrop.",
        error,
      );
      onState("unavailable");
    }

    import("./scene/experienceScene")
      .then(({ createExperienceScene }) => {
        if (cancelled || !canvasRef.current) return;
        scene = createExperienceScene(canvasRef.current, {
          paused: pausedRef.current,
          started: startedRef.current,
          status: statusRef.current,
          progress: measureProgress(),
          still: stillRef.current,
          onReady: () => {
            if (!cancelled && scene) onState(scene.lowPower ? "still" : "live");
          },
          onContextLost: () => unavailable(new Error("WebGL context lost.")),
          onLowPower: () => {
            if (!cancelled) onState("still");
          },
        });
        sceneRef.current = scene;
      })
      .catch(unavailable);

    // Section positions also move when fonts load or the layout reflows.
    const layoutObserver = new ResizeObserver(requestSync);
    layoutObserver.observe(document.body);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      layoutObserver.disconnect();
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      window.removeEventListener("pointermove", onPointerMove);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [onState]);

  return (
    <div
      className="scene"
      data-renderer={state === "live" || state === "still" ? "webgl" : "static"}
      data-mode={state}
      data-paused={paused}
      data-resting={paused || state === "still"}
      aria-hidden="true"
    >
      <div className="scene-fallback" />
      <canvas className="scene-live" ref={canvasRef} />
      <canvas className="scene-still" ref={stillRef} />
    </div>
  );
}
