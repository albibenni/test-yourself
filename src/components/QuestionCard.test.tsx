import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionCard } from "./QuestionCard";
import type { QuizQuestion } from "../types";

const mockQuestion: QuizQuestion = {
  id: "1",
  text: "What is the capital of France?",
  options: [
    { letter: "A", text: "London" },
    { letter: "B", text: "Paris" },
    { letter: "C", text: "Berlin" },
    { letter: "D", text: "Madrid" },
  ],
  correct_answer: "B",
  explanation: "Paris is the capital of France.",
};

describe("QuestionCard Component", () => {
  it("renders the question and options correctly", () => {
    render(<QuestionCard question={mockQuestion} />);
    expect(
      screen.getByText("1. What is the capital of France?"),
    ).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("handles correct answer selection", () => {
    render(<QuestionCard question={mockQuestion} />);
    const btnB = screen.getByText("Paris").closest("button")!;
    fireEvent.click(btnB);

    expect(screen.getByText("✨ Correct!")).toBeInTheDocument();
    expect(
      screen.getByText("Paris is the capital of France."),
    ).toBeInTheDocument();

    // Check that button has correct class
    expect(btnB).toHaveClass("correct");
    // All buttons should be disabled
    expect(btnB).toBeDisabled();
    expect(screen.getByText("London").closest("button")).toBeDisabled();
  });

  it("handles incorrect answer selection", () => {
    render(<QuestionCard question={mockQuestion} />);
    const btnA = screen.getByText("London").closest("button")!;
    fireEvent.click(btnA);

    expect(screen.getByText("❌ Incorrect")).toBeInTheDocument();
    expect(
      screen.getByText("Paris is the capital of France."),
    ).toBeInTheDocument();

    // The clicked button should have 'incorrect' class
    expect(btnA).toHaveClass("incorrect");
    // The correct button should still show as 'correct'
    const btnB = screen.getByText("Paris").closest("button")!;
    expect(btnB).toHaveClass("correct");
  });

  it("shows fallback explanation when no explanation is provided", () => {
    const qWithoutExp = { ...mockQuestion, explanation: "" };
    render(<QuestionCard question={qWithoutExp} />);
    const btnA = screen.getByText("London").closest("button")!;
    fireEvent.click(btnA);

    expect(screen.getByText("The correct answer is B.")).toBeInTheDocument();
  });

  it("prevents multiple selections", () => {
    render(<QuestionCard question={mockQuestion} />);
    const btnA = screen.getByText("London").closest("button")!;
    const btnB = screen.getByText("Paris").closest("button")!;

    fireEvent.click(btnA); // select incorrect
    expect(btnA).toHaveClass("incorrect");

    fireEvent.click(btnB); // try to select correct afterwards
    // Should NOT change selected letter, so B should not be visually 'selected', it just shows 'correct' because it's the right answer, but the overall state is already answered.
    expect(screen.getByText("❌ Incorrect")).toBeInTheDocument();
  });
});
