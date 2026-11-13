import { expect, test } from "@playwright/test";

const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:18208";

/** Reports a chosen GPU name so each scene quality tier can be exercised deterministically. */
function reportRenderer(name) {
  for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const original = context.prototype.getParameter;
    context.prototype.getParameter = function (parameter) {
      // 0x9246 is UNMASKED_RENDERER_WEBGL and 0x1f01 is RENDERER.
      if (parameter === 0x9246 || parameter === 0x1f01) return name;
      return original.call(this, parameter);
    };
  }
}

/** Counts WebGL draw calls so tests can tell whether the scene is rendering. */
function countDraws() {
  window.__sceneDraws = 0;
  for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const method of ["drawArrays", "drawElements"]) {
      const original = context.prototype[method];
      context.prototype[method] = function (...args) {
        window.__sceneDraws++;
        return original.apply(this, args);
      };
    }
  }
}

const draws = (page) => page.evaluate(() => window.__sceneDraws);

/** Hides or restores page chrome so a screenshot compares the scene alone. */
async function setHidden(page, selectors, hidden) {
  await page.evaluate(
    ([targets, hide]) => {
      for (const element of document.querySelectorAll(targets)) {
        element.style.visibility = hide ? "hidden" : "";
      }
    },
    [selectors, hidden],
  );
}

async function waitForCurtain(page) {
  await expect(page.locator(".preloader")).toHaveCount(0, { timeout: 10000 });
}

test("liveness, readiness, and migrated PostgreSQL metadata are real", async ({
  request,
}) => {
  for (const probe of ["liveness", "readiness"]) {
    const health = await request.get(`${apiBase}/actuator/health/${probe}`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "UP" });
  }
  const response = await request.get(`${apiBase}/api/v1/system`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    service: "firstwork-api",
    phase: "phase-1",
    schemaVersion: "phase-1",
    database: "reachable",
    syntheticOnly: true,
  });
});

test("browser loads the page and validates synthetic input through the API", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const document = await page.goto("/");
  expect(document?.status()).toBe(200);
  expect(document?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("API and database connected")).toBeVisible();
  await expect(page.getByText("phase-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Validate request" })).toBeDisabled();
  await page.getByLabel("Synthetic reference", { exact: true }).fill("synthetic-smoke");
  await page.getByRole("checkbox").check();
  const validation = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/sandbox/validate"),
  );
  await page.getByRole("button", { name: "Validate request" }).click();
  const response = await validation;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    reference: "synthetic-smoke",
    accepted: true,
    persisted: false,
  });
  await expect(page.getByRole("status").filter({ hasText: "Accepted:" })).toHaveText(
    "Accepted: synthetic-smoke. No data was persisted.",
  );
  expect(errors).toEqual([]);
});

test("real API rejects unsafe, malformed, coerced, and unexpected inputs", async ({
  request,
}) => {
  const bodies = [
    '{"reference":"synthetic-smoke","synthetic":false}',
    '{"reference":"not-synthetic","synthetic":true}',
    '{"reference":"synthetic-smoke","synthetic":"true"}',
    '{"reference":"synthetic-smoke","synthetic":true,"unexpected":1}',
    "{",
  ];
  for (const data of bodies) {
    const response = await request.post(`${apiBase}/api/v1/sandbox/validate`, {
      headers: { "Content-Type": "application/json" },
      data,
    });
    expect(response.status()).toBe(400);
    expect(response.headers()["content-type"]).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({ status: 400 });
    expect(await response.text()).not.toContain("stackTrace");
  }
  const wrongType = await request.post(`${apiBase}/api/v1/sandbox/validate`, {
    headers: { "Content-Type": "text/plain" },
    data: "synthetic-smoke",
  });
  expect(wrongType.status()).toBe(415);
});

test("frontend failures are visible and an explicit retry recovers", async ({ page }) => {
  await page.route("**/api/v1/system", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("System check failed.");
  await expect(page.getByText("API and database connected")).not.toBeVisible();
  await page.unroute("**/api/v1/system");
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("API and database connected")).toBeVisible();
  await expect(page.getByRole("alert")).not.toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1280, 1440]) {
  test(`page remains usable at ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("API and database connected")).toBeVisible();
    await expect(page.getByLabel("Synthetic reference", { exact: true })).toBeVisible();
    const overflowing = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflowing).toBe(false);
    const labLink = page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: "Lab", exact: true });
    await labLink.click();
    await expect(page).toHaveURL(/#request-lab$/);
    await expect(labLink).toHaveAttribute("aria-current", "location");
    await expect(
      page.getByRole("heading", { name: "Try a synthetic request" }),
    ).toBeInViewport();
  });
}

test("request inspector, validation feedback, reset, and keyboard navigation work", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const input = page.getByLabel("Synthetic reference", { exact: true });
  await input.fill("invalid-reference");
  await input.press("Tab");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText(
    "Enter a valid synthetic reference",
  );
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Validate request" })).toBeDisabled();
  await input.fill("synthetic-inspector");
  const inspector = page.locator("summary").filter({ hasText: "Inspect JSON" });
  await inspector.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Request JSON")).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Request JSON")).toContainText(
    '"reference": "synthetic-inspector"',
  );
  await page.getByRole("button", { name: "Validate request" }).click();
  await expect(page.getByLabel("Response JSON")).toContainText('"persisted": false');
  await page.getByRole("button", { name: "Reset request" }).click();
  await expect(input).toHaveValue("synthetic-demo");
  await expect(input).toBeFocused();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByLabel("Response JSON")).toHaveCount(0);
});

test("domain routes and sensitive actuator endpoints are not exposed", async ({
  request,
}) => {
  for (const path of ["/workers", "/cases", "/actuator/env", "/actuator/configprops"]) {
    const response = await request.get(`${apiBase}${path}`);
    expect(response.status()).toBe(404);
  }
});

test("the opening curtain lifts on its own, even when the API never answers", async ({
  page,
}) => {
  await page.route("**/api/v1/system", () => {});
  await page.goto("/");
  await expect(page.locator(".preloader")).toBeVisible();
  await waitForCurtain(page);
  await expect(page.locator(".hero-title .line > span").first()).toHaveCSS(
    "transform",
    "none",
  );
  await expect(page.getByText("API and database connected")).toHaveCount(0);
});

test("a software renderer gets a still scene that redraws only when the chapter changes", async ({
  page,
}) => {
  const requestedOrigins = new Set();
  const problems = [];
  page.on("request", (request) => requestedOrigins.add(new URL(request.url()).origin));
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  await page.addInitScript(reportRenderer, "Google SwiftShader");
  await page.addInitScript(countDraws);
  await page.goto("/");
  const scene = page.locator(".scene");
  await expect(scene).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  await expect(scene).toHaveAttribute("data-mode", "still");
  await waitForCurtain(page);
  await expect(scene.locator(".scene-still")).toHaveCSS("opacity", "1");
  await expect(page.getByText("API and database connected")).toBeVisible();
  await expect(
    page.getByText("Low-power rendering. The scene holds still."),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    [...document.fonts]
      .filter((font) => font.status === "loaded")
      .map((font) => font.family.replaceAll('"', "")),
  );
  expect(fonts).toEqual(
    expect.arrayContaining(["Manrope Variable", "Syne Variable", "Instrument Serif"]),
  );
  expect([...requestedOrigins]).toEqual([new URL(page.url()).origin]);
  expect(problems).toEqual([]);

  await setHidden(page, "main, .site-header", true);
  const settled = await draws(page);
  const still = await page.screenshot();
  await page.waitForTimeout(600);
  expect(await draws(page)).toBe(settled);
  expect((await page.screenshot()).equals(still)).toBe(true);

  // The scene follows the story by cutting to the form for the chapter in view.
  await page.evaluate(() =>
    document.querySelector("#system-health").scrollIntoView({ behavior: "instant" }),
  );
  await expect.poll(() => draws(page)).toBeGreaterThan(settled);
  await expect.poll(async () => (await page.screenshot()).equals(still)).toBe(false);
});

test("a hardware GPU animates the scene until motion is paused", async ({ page }) => {
  // A small viewport keeps continuous rendering affordable on a CI software rasteriser.
  await page.setViewportSize({ width: 640, height: 480 });
  await page.addInitScript(reportRenderer, "Test hardware GPU");
  await page.addInitScript(countDraws);
  await page.goto("/");
  const scene = page.locator(".scene");
  await expect(scene).toHaveAttribute("data-mode", "live", { timeout: 15000 });
  const first = await draws(page);
  await expect.poll(() => draws(page)).toBeGreaterThan(first + 6);

  await waitForCurtain(page);
  const pause = page.getByRole("button", { name: "Pause motion" });
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(scene).toHaveAttribute("data-paused", "true");
  // At rest the page shows a retained bitmap copy, not the idle WebGL surface.
  await expect(scene.locator(".scene-still")).toHaveCSS("opacity", "1");
  await expect(scene.locator(".scene-live")).toHaveCSS("visibility", "hidden");
  const paused = await draws(page);
  await page.waitForTimeout(600);
  expect(await draws(page)).toBe(paused);

  await page.evaluate(() =>
    document.querySelector("#system-health").scrollIntoView({ behavior: "instant" }),
  );
  await expect.poll(() => draws(page)).toBeGreaterThan(paused);
});

test("reduced motion skips the curtain, rests every reveal, and keeps the scene still", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0);
  const pause = page.getByRole("button", { name: "Pause motion" });
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(pause).toBeDisabled();
  const scene = page.locator(".scene");
  await expect(scene).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  await expect(scene).toHaveAttribute("data-paused", "true");
  await expect(page.locator(".tape-track")).toHaveCSS("animation-name", "none");
  for (const selector of [".hero-title", "#roadmap-heading", "#outro-heading"]) {
    await expect(page.locator(`${selector} .line > span`).first()).toHaveCSS(
      "transform",
      "none",
    );
  }
  await expect(page.locator(".lit-word").first()).toHaveCSS("opacity", "1");
  expect(await page.locator("[data-pin]").evaluate((el) => el.style.height)).toBe("");
  await expect(page.locator("[data-pin-track]")).toHaveCSS("transform", "none");
});

test("without WebGL the page shows a static backdrop and the real lab still works", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await expect(
    page.getByText("Interactive scene unavailable. Showing a static backdrop."),
  ).toBeVisible();
  await expect(page.locator(".scene")).toHaveAttribute("data-renderer", "static");
  await expect(page.getByText("API and database connected")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Validate request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Accepted:" })).toContainText(
    "No data was persisted.",
  );
});

test.describe("scene rendering budget on a high-density display", () => {
  test.use({ deviceScaleFactor: 2 });

  for (const [renderer, mode, ratio] of [
    ["Test hardware GPU", "live", 1.5],
    ["Google SwiftShader", "still", 1],
  ]) {
    test(`${renderer} is ${mode} and renders at ${ratio}x CSS resolution`, async ({
      page,
    }) => {
      await page.addInitScript(reportRenderer, renderer);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await expect(page.locator(".scene")).toHaveAttribute("data-mode", mode, {
        timeout: 20000,
      });
      const resolution = await page.locator(".scene-live").evaluate((canvas) => ({
        pixelWidth: canvas.width,
        cssWidth: canvas.clientWidth,
        deviceRatio: window.devicePixelRatio,
      }));
      expect(resolution.deviceRatio).toBe(2);
      expect(resolution.pixelWidth).toBe(Math.floor(resolution.cssWidth * ratio));
    });
  }
});

test("the pinned chapter moves sideways with scroll and follows keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await waitForCurtain(page);
  const section = page.locator("[data-pin]");
  const link = page.getByRole("link", { name: "Now watch it run" });
  const travel = await section.evaluate((el) => el.offsetHeight - window.innerHeight);
  expect(travel).toBeGreaterThan(200);

  const scrollIntoPin = (distance) =>
    section.evaluate(
      (el, offset) =>
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY + offset,
          behavior: "instant",
        }),
      distance,
    );

  await scrollIntoPin(0);
  await expect(link).not.toBeInViewport();
  await scrollIntoPin(travel);
  await expect(link).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);

  await scrollIntoPin(0);
  await expect(link).not.toBeInViewport();
  await section.focus();
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
});
