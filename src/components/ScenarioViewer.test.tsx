import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScenarioViewer } from "./ScenarioViewer";

describe("ScenarioViewer", () => {
  const scenario = {
    title: "Identity mismatch",
    path: "/vault/identity-mismatch.scenario.md",
    topic: "Security",
    last_modified: 1,
    content: `## Scenario

The certificate is trusted but the identity is for the \`development\` namespace.

\`\`\`text
spiffe://example.org/ns/dev/sa/payment-service
\`\`\`

## Your Response

Should this request be authorized?

## Answer Key

The TLS handshake can succeed, but authorization must deny the caller.`,
  };

  it("keeps the answer key hidden until the learner reveals it", () => {
    render(<ScenarioViewer scenario={scenario} />);

    expect(
      screen.queryByText(/authorization must deny/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Your Response" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reveal answer key/i }));

    expect(screen.getByText(/authorization must deny/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hide answer key/i }),
    ).toBeInTheDocument();
  });

  it("renders inline and fenced code instead of showing Markdown fences", () => {
    render(<ScenarioViewer scenario={scenario} />);

    expect(
      screen.getByText("development", { selector: "code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/spiffe:\/\/example.org\/ns\/dev/i, {
        selector: "code",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("```text")).not.toBeInTheDocument();
  });
});
