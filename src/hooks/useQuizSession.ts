import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuizQuestion } from "../types";
import { shuffleQuizQuestions } from "../utils/quizShuffle";

export function useQuizSession(
  sessionKey: string | undefined,
  questions: QuizQuestion[] | undefined,
) {
  const shuffledQuestions = useMemo(
    () => (sessionKey && questions ? shuffleQuizQuestions(questions) : []),
    [sessionKey, questions],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(10);
  const totalQuestions = shuffledQuestions.length;

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
  const correctCount = shuffledQuestions.filter(
    (question) => answers[question.id] === question.correct_answer,
  ).length;

  return {
    answers,
    setAnswers,
    questions: shuffledQuestions,
    visibleCount,
    totalQuestions,
    answeredCount,
    correctCount,
    isAllAnswered: totalQuestions > 0 && answeredCount === totalQuestions,
    lastQuestionElementRef,
  };
}
