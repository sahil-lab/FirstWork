import { useEffect, useRef } from "react";
import { useFinePointer } from "./motion";

const INTERACTIVE = "a, button, summary, input, label";

/** Decorative follower drawn alongside the native cursor, never instead of it. */
export function Cursor({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useFinePointer() && enabled;

  useEffect(() => {
    const element = ref.current;
    if (!element || !active) return;

    function onMove(event: PointerEvent) {
      if (!element || event.pointerType !== "mouse") return;
      element.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      element.dataset.visible = "true";
      const target = event.target instanceof Element ? event.target : null;
      element.dataset.active = target?.closest(INTERACTIVE) ? "true" : "false";
    }

    function onLeave() {
      if (element) element.dataset.visible = "false";
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [active]);

  if (!active) return null;
  return (
    <div className="cursor" ref={ref} aria-hidden="true">
      <span />
    </div>
  );
}
