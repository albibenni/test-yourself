import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

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

  it("lets the learner self-assess expressed knowledge without grading the text", () => {
    const onComplete = vi.fn();
    render(<QuestionViewer document={document} onComplete={onComplete} />);

    fireEvent.click(
      screen.getByRole("button", { name: /reveal suggested answer 1/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("Self-assessed: Got it")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /reveal suggested answer 2/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Partially" }));

    expect(onComplete).toHaveBeenCalledWith({
      "1": "correct",
      "2": "partial",
    });
  });

  it("accepts a spoken or mental answer without requiring textarea input", () => {
    render(<QuestionViewer document={document} />);

    fireEvent.click(
      screen.getByRole("button", { name: /reveal suggested answer 1/i }),
    );

    expect(screen.getByRole("button", { name: "Didn't know" })).toBeEnabled();
  });
});
