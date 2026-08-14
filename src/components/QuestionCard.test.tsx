import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "../types";
import { shuffleQuizQuestions } from "../utils/quizShuffle";
import { QuestionCard } from "./QuestionCard";

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

const secondQuestion: QuizQuestion = {
  id: "2",
  text: "Which planet is known as the Red Planet?",
  options: [
    { letter: "A", text: "Venus" },
    { letter: "B", text: "Earth" },
    { letter: "C", text: "Jupiter" },
    { letter: "D", text: "Mars" },
  ],
  correct_answer: "D",
  explanation: "Mars appears red because of iron oxides in its surface dust.",
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

  it("evaluates shuffled answers independently and keeps each explanation", () => {
    const [shuffledFirstQuestion, shuffledSecondQuestion] =
      shuffleQuizQuestions([mockQuestion, secondQuestion], () => 0);

    render(
      <>
        <QuestionCard question={shuffledFirstQuestion!} />
        <QuestionCard question={shuffledSecondQuestion!} />
      </>,
    );

    const firstCard = screen
      .getByText("1. What is the capital of France?")
      .closest<HTMLDivElement>(".question-card")!;
    const secondCard = screen
      .getByText("2. Which planet is known as the Red Planet?")
      .closest<HTMLDivElement>(".question-card")!;

    fireEvent.click(within(firstCard).getByText("Paris"));
    expect(within(firstCard).getByText("✨ Correct!")).toBeInTheDocument();
    expect(
      within(firstCard).getByText("Paris is the capital of France."),
    ).toBeInTheDocument();

    fireEvent.click(within(secondCard).getByText("Earth"));
    expect(within(secondCard).getByText("❌ Incorrect")).toBeInTheDocument();
    expect(
      within(secondCard).getByText(
        "Mars appears red because of iron oxides in its surface dust.",
      ),
    ).toBeInTheDocument();
    expect(within(secondCard).getByText("Mars").closest("button")).toHaveClass(
      "correct",
    );
  });
});
