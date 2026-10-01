import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function QuizViewerWithSession({
  sessionQuiz = quiz,
  initialVisibleCount = sessionQuiz.questions.length,
}: {
  sessionQuiz?: Quiz;
  initialVisibleCount?: number;
} = {}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const answeredCount = Object.keys(answers).length;

  const sessionMetadata: QuizMetadata = {
    title: sessionQuiz.title,
    path: sessionQuiz.path,
    topic: sessionQuiz.topic,
    last_modified: sessionQuiz.last_modified,
  };

  return (
    <QuizViewer
      selectedQuiz={sessionMetadata}
      activeQuiz={sessionQuiz}
      activeWorksheet={null}
      activeQuestionDocument={null}
      loadingActiveQuiz={false}
      resetKey={0}
      onReset={() => undefined}
      onSchedule={() => undefined}
      answers={answers}
      setAnswers={setAnswers}
      visibleCount={visibleCount}
      ensureQuestionVisible={(index) =>
        setVisibleCount((current) => Math.max(current, index + 1))
      }
      totalQuestions={sessionQuiz.questions.length}
      answeredCount={answeredCount}
      correctCount={
        sessionQuiz.questions.filter(
          (question) => answers[question.id] === question.correct_answer,
        ).length
      }
      isAllAnswered={answeredCount === sessionQuiz.questions.length}
      lastQuestionElementRef={() => undefined}
    />
  );
}

describe("QuizViewer", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  afterEach(() => {
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

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

  it("centers and focuses the next unanswered question after an answer", () => {
    render(<QuizViewerWithSession />);

    const nextCard = screen
      .getByText("2. Last question")
      .closest<HTMLElement>(".question-card")!;
    const scrollIntoView = vi.fn();
    nextCard.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByText("First answer"));

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(screen.getByText("Last answer").closest("button")).toHaveFocus();
  });

  it("skips answered questions when navigating forward", () => {
    const threeQuestionQuiz: Quiz = {
      ...quiz,
      questions: [
        ...quiz.questions,
        {
          id: "3",
          text: "Third question",
          options: [{ letter: "C", text: "Third answer" }],
          correct_answer: "C",
          explanation: "",
        },
      ],
    };
    render(<QuizViewerWithSession sessionQuiz={threeQuestionQuiz} />);

    fireEvent.click(screen.getByText("Last answer"));
    const thirdCard = screen
      .getByText("3. Third question")
      .closest<HTMLElement>(".question-card")!;
    const scrollIntoView = vi.fn();
    thirdCard.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByText("First answer"));

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(screen.getByText("Third answer").closest("button")).toHaveFocus();
  });

  it("reveals and navigates to the next lazy-loaded question", () => {
    const paginatedQuiz: Quiz = {
      ...quiz,
      questions: Array.from({ length: 11 }, (_, index) => ({
        id: String(index + 1),
        text: `Question ${index + 1}`,
        options: [{ letter: "A", text: `Answer ${index + 1}` }],
        correct_answer: "A",
        explanation: "",
      })),
    };
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <QuizViewerWithSession
        sessionQuiz={paginatedQuiz}
        initialVisibleCount={10}
      />,
    );

    expect(screen.queryByText("11. Question 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Answer 10"));

    expect(screen.getByText("11. Question 11")).toBeInTheDocument();
    expect(screen.getByText("Answer 11").closest("button")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("does not navigate after answering the final question", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<QuizViewerWithSession />);

    fireEvent.click(screen.getByText("Last answer"));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
