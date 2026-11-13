export interface SceneAnchor {
  top: number;
  bottom: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Maps where the viewport centre sits among ordered sections to a continuous
 * form index. A form is held while the centre is inside its section and blends
 * into the next one in the gap between two sections.
 */
export function sceneProgress(
  anchors: readonly SceneAnchor[],
  viewportHeight: number,
): number {
  const centre = viewportHeight / 2;
  const margin = viewportHeight * 0.3;
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (!anchor) continue;
    const inset = Math.min(margin, (anchor.bottom - anchor.top) / 2);
    const holdStart = anchor.top + inset;
    const holdEnd = anchor.bottom - inset;
    if (centre < holdStart) {
      if (index === 0) return 0;
      const span = holdStart - previousEnd;
      return index - 1 + (span > 0 ? clamp((centre - previousEnd) / span, 0, 1) : 1);
    }
    if (centre <= holdEnd) return index;
    previousEnd = holdEnd;
  }
  return Math.max(0, anchors.length - 1);
}
