import { describe, expect, it } from "vitest";
import { sceneProgress } from "./progress";

const viewport = 1000;

/** Two stacked full-height sections, positioned for a given scroll offset. */
function page(scroll: number) {
  return [
    { top: -scroll, bottom: 1000 - scroll },
    { top: 1000 - scroll, bottom: 2000 - scroll },
  ];
}

describe("sceneProgress", () => {
  it("holds a form while the viewport centre is inside its section", () => {
    expect(sceneProgress(page(0), viewport)).toBe(0);
    expect(sceneProgress(page(1000), viewport)).toBe(1);
  });

  it("blends between two sections in proportion to the scroll between them", () => {
    expect(sceneProgress(page(350), viewport)).toBeCloseTo(0.25);
    expect(sceneProgress(page(500), viewport)).toBeCloseTo(0.5);
    expect(sceneProgress(page(650), viewport)).toBeCloseTo(0.75);
  });

  it("stays on the first form before the page and the last form after it", () => {
    expect(sceneProgress([{ top: 800, bottom: 1800 }], viewport)).toBe(0);
    expect(sceneProgress(page(4000), viewport)).toBe(1);
  });

  it("still reaches a section shorter than the hold margins", () => {
    const anchors = [
      { top: -900, bottom: 100 },
      { top: 450, bottom: 550 },
    ];
    expect(sceneProgress(anchors, viewport)).toBe(1);
  });

  it("returns the first form when no sections exist", () => {
    expect(sceneProgress([], viewport)).toBe(0);
  });
});
