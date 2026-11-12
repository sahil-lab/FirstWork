export interface SystemStatus {
  service: "firstwork-api";
  phase: "phase-1";
  schemaVersion: string;
  database: "reachable";
  syntheticOnly: true;
}

export interface ValidationResult {
  reference: string;
  accepted: true;
  persisted: false;
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unexpected API error. Check the local stack and try again.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestJson(path: string, options: RequestInit = {}): Promise<unknown> {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000);
  const response = await fetch(path, { ...options, signal });
  if (!response.headers.get("content-type")?.includes("json")) {
    throw new Error(
      `Unexpected API response (HTTP ${response.status}). Check the local stack.`,
    );
  }
  const body: unknown = await response.json();
  if (!response.ok) {
    let detail = `API request failed (HTTP ${response.status}).`;
    if (isRecord(body) && typeof body.detail === "string") {
      detail = body.detail;
      if (Array.isArray(body.errors)) {
        const issues = body.errors
          .filter(isRecord)
          .filter(
            (issue) =>
              typeof issue.field === "string" && typeof issue.message === "string",
          )
          .map((issue) => `${issue.field}: ${issue.message}`);
        detail = [detail, ...issues].join(" ");
      }
    }
    throw new Error(detail);
  }
  return body;
}

export async function fetchSystem(signal?: AbortSignal): Promise<SystemStatus> {
  const body = await requestJson("/api/v1/system", { signal });
  if (
    !isRecord(body) ||
    body.service !== "firstwork-api" ||
    body.phase !== "phase-1" ||
    typeof body.schemaVersion !== "string" ||
    body.schemaVersion.length === 0 ||
    body.database !== "reachable" ||
    body.syntheticOnly !== true
  ) {
    throw new Error("System status did not match the API contract.");
  }
  return {
    service: body.service,
    phase: body.phase,
    schemaVersion: body.schemaVersion,
    database: body.database,
    syntheticOnly: body.syntheticOnly,
  };
}

export async function validateSandbox(
  reference: string,
  synthetic: boolean,
): Promise<ValidationResult> {
  const body = await requestJson("/api/v1/sandbox/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, synthetic }),
  });
  if (
    !isRecord(body) ||
    body.reference !== reference ||
    body.accepted !== true ||
    body.persisted !== false
  ) {
    throw new Error("Validation response did not match the API contract.");
  }
  return { reference, accepted: body.accepted, persisted: body.persisted };
}
