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

  it.each(["Model Answer", "Solution"])(
    "hides a %s section until it is revealed",
    (answerHeading) => {
      render(
        <ScenarioViewer
          scenario={{
            ...scenario,
            content: `## Scenario\n\nEvidence\n\n## ${answerHeading}\n\nHidden solution`,
          }}
        />,
      );

      expect(screen.queryByText("Hidden solution")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reveal answer key/i }),
      ).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(
        screen.getByRole("button", { name: /reveal answer key/i }),
      );
      expect(screen.getByText("Hidden solution")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /hide answer key/i }),
      ).toHaveAttribute("aria-expanded", "true");
    },
  );

  it("handles scenarios without an answer key", () => {
    render(
      <ScenarioViewer
        scenario={{ ...scenario, content: "## Scenario\n\nOnly the prompt." }}
      />,
    );

    expect(screen.getByText("Only the prompt.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /answer key/i }),
    ).not.toBeInTheDocument();
  });

  it("clears a response when the learner switches scenarios", () => {
    const { rerender } = render(<ScenarioViewer scenario={scenario} />);
    const response = screen.getByRole("textbox", { name: "Your Response" });
    fireEvent.change(response, { target: { value: "My diagnosis" } });
    expect(response).toHaveValue("My diagnosis");

    rerender(
      <ScenarioViewer
        scenario={{ ...scenario, path: "/vault/next.scenario.md" }}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Your Response" })).toHaveValue(
      "",
    );
  });

  it("renders multiple fenced blocks and numbered lists", () => {
    render(
      <ScenarioViewer
        scenario={{
          ...scenario,
          content: `## Scenario

\`\`\`text
first
\`\`\`

1. Inspect the SVID
2. Match the policy

\`\`\`text
second
\`\`\``,
        }}
      />,
    );

    expect(screen.getAllByText(/^(first|second)$/)).toHaveLength(2);
    expect(screen.getByRole("list")).toHaveTextContent("Inspect the SVID");
  });
});
