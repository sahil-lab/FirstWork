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

test("mobile layout remains usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("API and database connected")).toBeVisible();
  await expect(page.getByLabel("Synthetic reference", { exact: true })).toBeVisible();
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing).toBe(false);
});

test("domain routes and sensitive actuator endpoints are not exposed", async ({
  request,
}) => {
  for (const path of ["/workers", "/cases", "/actuator/env", "/actuator/configprops"]) {
    const response = await request.get(`${apiBase}${path}`);
    expect(response.status()).toBe(404);
  }
});
