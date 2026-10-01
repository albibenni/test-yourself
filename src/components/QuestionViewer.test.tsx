import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionViewer } from "./QuestionViewer";

describe("QuestionViewer", () => {
  const document = {
    title: "Identity checks",
    path: "/vault/identity-checks.question.md",
    topic: "Security",
    last_modified: 1,
    questions: [
      {
        id: 1,
        question: "Why validate the `SPIFFE ID`?",
        answer: "To establish the caller's **workload identity**.",
      },
      {
        id: 2,
        question: "Review this policy:\n\n```text\ndeny unknown\n```",
        answer: "It denies callers without a matching policy.",
      },
    ],
  };

  it("reveals suggested answers one question at a time", () => {
    render(<QuestionViewer document={document} />);

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryByText(/workload identity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/denies callers/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /question 1/i }), {
      target: { value: "My response" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /reveal suggested answer 1/i }),
    );

    expect(screen.getByText(/workload identity/i)).toBeInTheDocument();
    expect(screen.queryByText(/denies callers/i)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /question 1/i })).toHaveValue(
      "My response",
    );
  });

  it("renders inline and fenced code as Markdown content", () => {
    render(<QuestionViewer document={document} />);

    expect(
      screen.getByText("SPIFFE ID", { selector: "code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("deny unknown", { selector: "code" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("```text")).not.toBeInTheDocument();
  });

  it("clears responses and revealed answers when the document changes", () => {
    const { rerender } = render(<QuestionViewer document={document} />);
    fireEvent.change(screen.getByRole("textbox", { name: /question 1/i }), {
      target: { value: "My response" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /reveal suggested answer 1/i }),
    );

    rerender(
      <QuestionViewer
        document={{ ...document, path: "/vault/next.question.md" }}
      />,
    );

    expect(screen.getByRole("textbox", { name: /question 1/i })).toHaveValue(
      "",
    );
    expect(screen.queryByText(/workload identity/i)).not.toBeInTheDocument();
  });
});
