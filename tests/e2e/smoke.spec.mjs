import { expect, test } from "@playwright/test";

const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:18208";

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

test("browser loads the dashboard and validates synthetic input through the API", async ({
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
  test(`workspace remains usable at ${width}px without horizontal overflow`, async ({
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
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: "Request lab" })
      .click();
    await expect(page).toHaveURL(/#request-lab$/);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Request lab" }),
    ).toHaveAttribute("aria-current", "location");
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

test("the original 3D sculpture renders and can be paused and rotated", async ({
  page,
}) => {
  const requestedOrigins = new Set();
  page.on("request", (request) => requestedOrigins.add(new URL(request.url()).origin));
  await page.goto("/");
  const artwork = page.locator(".sculpture");
  await expect(artwork).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    [...document.fonts]
      .filter((font) => font.status === "loaded")
      .map((font) => font.family.replaceAll('"', "")),
  );
  expect(fonts).toEqual(expect.arrayContaining(["Manrope Variable", "Syne Variable"]));
  expect([...requestedOrigins]).toEqual([new URL(page.url()).origin]);
  const pause = page.getByRole("button", { name: "Pause motion" });
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(artwork).toHaveAttribute("data-paused", "true");
  const canvas = artwork.locator("canvas");
  await expect(canvas).toHaveCSS("opacity", "1");
  const before = await canvas.screenshot();
  await page.getByRole("button", { name: "Rotate sculpture" }).click();
  await expect(page.getByText("/ Angle 02", { exact: true })).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  await pause.click();
  await expect(artwork).toHaveAttribute("data-paused", "false");
});

test.describe("high-density display budget", () => {
  test.use({ deviceScaleFactor: 2 });
  test("the artwork caps rendering resolution instead of using an unbounded pixel ratio", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".sculpture")).toHaveAttribute("data-renderer", "webgl", {
      timeout: 15000,
    });
    const resolution = await page.locator(".sculpture canvas").evaluate((canvas) => ({
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      cssWidth: canvas.getBoundingClientRect().width,
      cssHeight: canvas.getBoundingClientRect().height,
      deviceRatio: window.devicePixelRatio,
    }));
    expect(resolution.deviceRatio).toBe(2);
    expect(resolution.pixelWidth).toBeGreaterThan(0);
    expect(resolution.pixelWidth).toBeLessThanOrEqual(
      Math.ceil(resolution.cssWidth * 1.25),
    );
    expect(resolution.pixelHeight).toBeLessThanOrEqual(
      Math.ceil(resolution.cssHeight * 1.25),
    );
  });
});

test("reduced motion starts with a still sculpture and stops decorative animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const pause = page.getByRole("button", { name: "Pause motion" });
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(pause).toBeDisabled();
  await expect(page.locator(".sculpture")).toHaveAttribute("data-renderer", "webgl", {
    timeout: 15000,
  });
  await expect(page.locator(".sculpture")).toHaveAttribute("data-paused", "true");
  await expect(page.locator(".tape-track")).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "Rotate sculpture" }).click();
  await expect(page.getByText("/ Angle 02", { exact: true })).toBeVisible();
});

test("without WebGL the artwork has an explicit fallback and the real lab still works", async ({
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
    page.getByText("3D artwork unavailable. Showing the static illustration."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Rotate sculpture" })).toBeDisabled();
  await expect(page.getByText("API and database connected")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Validate request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Accepted:" })).toContainText(
    "No data was persisted.",
  );
});
