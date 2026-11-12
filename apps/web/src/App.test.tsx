import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { fetchSystem, validateSandbox } from "./api";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  fetchSystem: vi.fn(),
  validateSandbox: vi.fn(),
}));

vi.mock("./Sculpture", () => ({
  Sculpture: () => <div aria-label="Decorative sculpture" />,
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

  it("keeps the JSON preview in sync and resets input, consent, and prior results", async () => {
    const user = userEvent.setup();
    vi.mocked(validateSandbox).mockResolvedValue({
      reference: "synthetic-preview",
      accepted: true,
      persisted: false,
    });
    render(<App />);
    await screen.findByText("API and database connected");
    const input = screen.getByLabelText("Synthetic reference", { exact: true });
    await user.clear(input);
    await user.type(input, "synthetic-preview");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByLabelText("Request JSON")).toHaveTextContent(
      '"reference": "synthetic-preview"',
    );
    expect(screen.getByLabelText("Request JSON")).toHaveTextContent('"synthetic": true');
    await user.click(screen.getByRole("button", { name: "Validate request" }));
    expect(await screen.findByLabelText("Response JSON")).toHaveTextContent(
      '"persisted": false',
    );
    await user.click(screen.getByRole("button", { name: "Reset request" }));
    expect(input).toHaveValue("synthetic-demo");
    expect(input).toHaveFocus();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Validate request" })).toBeDisabled();
    expect(screen.queryByLabelText("Response JSON")).not.toBeInTheDocument();
    expect(screen.queryByText(/Accepted:/)).not.toBeInTheDocument();
  });

  it("explains invalid references and prevents a request until the input is fixed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("API and database connected");
    const input = screen.getByLabelText("Synthetic reference", { exact: true });
    await user.clear(input);
    await user.type(input, "not-synthetic");
    await user.tab();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid synthetic reference",
    );
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Validate request" })).toBeDisabled();
    expect(validateSandbox).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, "synthetic-fixed");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate request" })).toBeEnabled();
  });

  it("does not show connected services before the system check resolves", async () => {
    vi.mocked(fetchSystem).mockImplementation(() => new Promise(() => {}));
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking API and database");
    expect(screen.getByRole("button", { name: "Refresh status" })).toBeDisabled();
    expect(screen.queryByText("Reachable")).not.toBeInTheDocument();
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
  });
});
