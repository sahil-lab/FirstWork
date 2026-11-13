import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

function mediaStore(query: string) {
  return {
    subscribe(listener: () => void) {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    snapshot: () => window.matchMedia(query).matches,
  };
}

const reducedMotionStore = mediaStore("(prefers-reduced-motion: reduce)");
const finePointerStore = mediaStore("(hover: hover) and (pointer: fine)");

export function useReducedMotion() {
  return useSyncExternalStore(
    reducedMotionStore.subscribe,
    reducedMotionStore.snapshot,
    () => true,
  );
}

export function useFinePointer() {
  return useSyncExternalStore(
    finePointerStore.subscribe,
    finePointerStore.snapshot,
    () => false,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Scroll-linked page behaviour: reveal-on-enter, the lit statement, the pinned
 * horizontal chapter and the header progress meter. Everything follows the
 * native scroll position; nothing takes over scrolling.
 */
export function usePageMotion(
  root: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;

    const revealTargets = [...host.querySelectorAll<HTMLElement>("[data-reveal]")];
    let observer: IntersectionObserver | undefined;
    if (reducedMotion) {
      for (const target of revealTargets) target.classList.add("is-inview");
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-inview");
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
      );
      for (const target of revealTargets) observer.observe(target);
    }

    const statement = host.querySelector<HTMLElement>("[data-lit]");
    const words = statement
      ? [...statement.querySelectorAll<HTMLElement>(".lit-word")]
      : [];
    const pinSection = host.querySelector<HTMLElement>("[data-pin]");
    const pinStage = host.querySelector<HTMLElement>("[data-pin-stage]");
    const pinTrack = host.querySelector<HTMLElement>("[data-pin-track]");
    const meter = host.querySelector<HTMLElement>(".scroll-meter");
    let travel = 0;
    let frame = 0;
    let disposed = false;

    // The stylesheet decides when there is room to pin; this only measures it.
    function layout() {
      if (!pinSection || !pinStage || !pinTrack) return;
      const pinned = !reducedMotion && getComputedStyle(pinStage).position === "sticky";
      travel = pinned
        ? Math.max(0, pinTrack.scrollWidth - document.documentElement.clientWidth)
        : 0;
      if (travel > 0) {
        pinSection.style.height = `${window.innerHeight + travel}px`;
      } else {
        pinSection.style.removeProperty("height");
        pinTrack.style.removeProperty("transform");
      }
    }

    function update() {
      frame = 0;
      const viewport = window.innerHeight;
      const scrollable = document.documentElement.scrollHeight - viewport;
      meter?.style.setProperty(
        "--scroll",
        scrollable > 0 ? clamp(window.scrollY / scrollable, 0, 1).toFixed(4) : "0",
      );
      host?.toggleAttribute("data-scrolled", window.scrollY > 24);
      if (statement && !reducedMotion) {
        const rect = statement.getBoundingClientRect();
        const progress = clamp(
          (viewport * 0.82 - rect.top) / (rect.height + viewport * 0.35),
          0,
          1,
        );
        const lit = Math.round(progress * words.length);
        words.forEach((word, index) => word.classList.toggle("is-lit", index < lit));
      }
      if (pinSection && pinTrack && travel > 0) {
        const progress = clamp(-pinSection.getBoundingClientRect().top / travel, 0, 1);
        pinTrack.style.transform = `translate3d(${(-progress * travel).toFixed(1)}px, 0, 0)`;
      }
    }

    function requestUpdate() {
      if (frame === 0) frame = requestAnimationFrame(update);
    }

    function onResize() {
      if (disposed) return;
      layout();
      requestUpdate();
    }

    // Keyboard focus inside the pinned track scrolls the page to reveal it.
    function onTrackFocus(event: FocusEvent) {
      const target = event.target;
      if (!pinSection || !pinTrack || travel <= 0) return;
      if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
      const item = target.getBoundingClientRect();
      const track = pinTrack.getBoundingClientRect();
      const offset = clamp(
        item.left -
          track.left +
          item.width / 2 -
          document.documentElement.clientWidth / 2,
        0,
        travel,
      );
      window.scrollTo({
        top: pinSection.getBoundingClientRect().top + window.scrollY + offset,
      });
    }

    layout();
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", onResize);
    pinTrack?.addEventListener("focusin", onTrackFocus);
    // Webfonts change the track width once they arrive.
    void document.fonts?.ready.then(onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", onResize);
      pinTrack?.removeEventListener("focusin", onTrackFocus);
      pinSection?.style.removeProperty("height");
      pinTrack?.style.removeProperty("transform");
    };
  }, [root, reducedMotion]);
}

/** Reports which of the given sections is being read, so navigation can follow the scroll. */
export function useActiveSection<T extends string>(ids: readonly T[], fallback: T): T {
  const [active, setActive] = useState<T>(fallback);

  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const readingLine = window.innerHeight * 0.4;
      let current = fallback;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= readingLine) current = id;
      }
      setActive(current);
    }

    function requestUpdate() {
      if (frame === 0) frame = requestAnimationFrame(update);
    }

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [ids, fallback]);

  return active;
}

/** Lets a link lean towards the cursor. Only active for precise pointers. */
export function useMagnetic<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  const finePointer = useFinePointer();
  const active = enabled && finePointer;

  useEffect(() => {
    const element = ref.current;
    if (!element || !active) return;

    function onMove(event: PointerEvent) {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      element.style.transform = `translate3d(${(x * 0.28).toFixed(1)}px, ${(y * 0.4).toFixed(1)}px, 0)`;
    }

    function onLeave() {
      element?.style.removeProperty("transform");
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [active]);

  return ref;
}
