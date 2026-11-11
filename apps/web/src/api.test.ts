import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSystem, validateSandbox } from "./api";

afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, status = 200, contentType = "application/json") {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

describe("API boundary", () => {
  it("rejects success-shaped responses missing database evidence", async () => {
    respond({ service: "firstwork-api", phase: "phase-1" });
    await expect(fetchSystem()).rejects.toThrow("did not match the API contract");
  });

  it("surfaces field errors from Problem Details", async () => {
    respond(
      {
        detail: "Request validation failed.",
        errors: [{ field: "synthetic", message: "must be true" }],
      },
      400,
      "application/problem+json",
    );
    await expect(validateSandbox("synthetic-demo", false)).rejects.toThrow(
      "synthetic: must be true",
    );
  });

  it("does not accept an unexpected persistence claim", async () => {
    respond({ reference: "synthetic-demo", accepted: true, persisted: true });
    await expect(validateSandbox("synthetic-demo", true)).rejects.toThrow(
      "did not match the API contract",
    );
  });

  it("reports proxy errors explicitly", async () => {
    respond("Bad gateway", 502, "text/html");
    await expect(fetchSystem()).rejects.toThrow("HTTP 502");
  });
});
