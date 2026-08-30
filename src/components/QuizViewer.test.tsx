import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Quiz, QuizMetadata } from "../types";
import { QuizViewer } from "./QuizViewer";

const quiz: Quiz = {
  title: "Order-independent quiz",
  path: "/quizzes/order.md",
  topic: "Testing",
  last_modified: 0,
  questions: [
    {
      id: "1",
      text: "First question",
      options: [{ letter: "A", text: "First answer" }],
      correct_answer: "A",
      explanation: "",
    },
    {
      id: "2",
      text: "Last question",
      options: [{ letter: "B", text: "Last answer" }],
      correct_answer: "B",
      explanation: "",
    },
  ],
};

const selectedQuiz: QuizMetadata = {
  title: quiz.title,
  path: quiz.path,
  topic: quiz.topic,
  last_modified: 0,
};

function QuizViewerWithSession() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answeredCount = Object.keys(answers).length;

  return (
    <QuizViewer
      selectedQuiz={selectedQuiz}
      activeQuiz={quiz}
      activeWorksheet={null}
      activeScenario={null}
      loadingActiveQuiz={false}
      resetKey={0}
      onReset={() => undefined}
      onSchedule={() => undefined}
      answers={answers}
      setAnswers={setAnswers}
      visibleCount={quiz.questions.length}
      totalQuestions={quiz.questions.length}
      answeredCount={answeredCount}
      correctCount={
        quiz.questions.filter(
          (question) => answers[question.id] === question.correct_answer,
        ).length
      }
      isAllAnswered={answeredCount === quiz.questions.length}
      lastQuestionElementRef={() => undefined}
    />
  );
}

describe("QuizViewer", () => {
  it("places topic, progress, and session actions in a sticky question-view row", () => {
    render(<QuizViewerWithSession />);

    expect(
      screen.getByText("0 of 2 answered").closest(".quiz-meta-row"),
    ).toHaveClass("quiz-meta-row--sticky");
    expect(
      screen
        .getByRole("heading", { name: quiz.title })
        .closest(".quiz-question-toolbar"),
    ).toBeInTheDocument();
  });

  it("completes when the last question is answered before earlier questions", () => {
    render(<QuizViewerWithSession />);

    fireEvent.click(screen.getByText("Last answer"));
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(screen.queryByText("Quiz Review")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("First answer"));

    expect(screen.getByText("2 of 2 answered")).toBeInTheDocument();
    expect(screen.getByText("Quiz Review")).toBeInTheDocument();
    expect(
      screen.getByText("You scored 2 out of 2 (100%)"),
    ).toBeInTheDocument();
  });
});
