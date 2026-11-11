import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { fetchSystem, validateSandbox } from "./api";

vi.mock("./api", () => ({
  fetchSystem: vi.fn(),
  validateSandbox: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchSystem).mockResolvedValue({
    service: "firstwork-api",
    phase: "phase-1",
    schemaVersion: "phase-1",
    database: "reachable",
    syntheticOnly: true,
  });
});

describe("Phase 1 dashboard", () => {
  it("loads real status and requires synthetic confirmation before submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(validateSandbox).mockResolvedValue({
      reference: "synthetic-demo",
      accepted: true,
      persisted: false,
    });
    render(<App />);
    expect(await screen.findByText("API and database connected")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Validate request" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(submit);
    expect(validateSandbox).toHaveBeenCalledWith("synthetic-demo", true);
    expect(
      await screen.findByText(/Accepted: synthetic-demo. No data was persisted/),
    ).toBeInTheDocument();
  });

  it("shows failed system checks and allows an explicit retry", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchSystem).mockRejectedValueOnce(new Error("Database is unavailable."));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database is unavailable.",
    );
    expect(screen.queryByText("API and database connected")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(await screen.findByText("API and database connected")).toBeInTheDocument();
  });

  it("renders validation errors instead of claiming a successful request", async () => {
    const user = userEvent.setup();
    vi.mocked(validateSandbox).mockRejectedValue(
      new Error("Synthetic confirmation is required."),
    );
    render(<App />);
    await screen.findByText("API and database connected");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Validate request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Synthetic confirmation is required.",
    );
    expect(screen.queryByText(/No data was persisted/)).not.toBeInTheDocument();
  });
});
