import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "../types";

export function useQuizSession(
  sessionKey: string | undefined,
  questions: QuizQuestion[] | undefined,
) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(10);
  const totalQuestions = questions?.length ?? 0;

  useEffect(() => {
    setAnswers({});
    setVisibleCount(sessionKey ? 10 : 0);
  }, [sessionKey]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastQuestionElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (!node || totalQuestions === 0) return;

      observer.current = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + 10, totalQuestions));
        }
      });
      observer.current.observe(node);
    },
    [totalQuestions],
  );

  const answeredCount = Object.keys(answers).length;
  const correctCount =
    questions?.filter(
      (question) => answers[question.id] === question.correct_answer,
    ).length ?? 0;

  return {
    answers,
    setAnswers,
    visibleCount,
    totalQuestions,
    answeredCount,
    correctCount,
    isAllAnswered: totalQuestions > 0 && answeredCount === totalQuestions,
    lastQuestionElementRef,
  };
}
