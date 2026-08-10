import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "../types";
import { useQuizSession } from "./useQuizSession";

const questions: QuizQuestion[] = [
  {
    id: "1",
    text: "Question",
    options: [],
    correct_answer: "A",
    explanation: "Explanation",
  },
];

describe("useQuizSession", () => {
  it("resets answers and restores the initial page when the quiz changes", () => {
    const { result, rerender } = renderHook(
      ({ sessionKey }) => useQuizSession(sessionKey, questions),
      { initialProps: { sessionKey: "/quizzes/a.md:0" } },
    );

    act(() => result.current.setAnswers({ "1": "A" }));
    expect(result.current.answeredCount).toBe(1);

    rerender({ sessionKey: "/quizzes/b.md:0" });

    expect(result.current.answers).toEqual({});
    expect(result.current.visibleCount).toBe(10);
  });

  it("calculates completion and score from submitted answers", () => {
    const { result } = renderHook(() =>
      useQuizSession("/quizzes/a.md:0", questions),
    );

    act(() => result.current.setAnswers({ "1": "A" }));

    expect(result.current.isAllAnswered).toBe(true);
    expect(result.current.correctCount).toBe(1);
  });
});
