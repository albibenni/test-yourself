import { openUrl } from "@tauri-apps/plugin-opener";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEFAULT_TOPIC } from "../constants";
import type { QuestionDocument, Quiz, QuizMetadata, Worksheet } from "../types";
import { focusAndCenter } from "../utils/focusAndCenter";
import { QuestionCard } from "./QuestionCard";
import { QuestionViewer } from "./QuestionViewer";
import { StatusIcon } from "./StatusIcon";
import { StatusView } from "./StatusView";
import { WorksheetViewer } from "./WorksheetViewer";

interface QuizSessionState {
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  visibleCount: number;
  ensureQuestionVisible: (questionIndex: number) => void;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  isAllAnswered: boolean;
  lastQuestionElementRef:
    | RefObject<HTMLDivElement | null>
    | ((node: HTMLDivElement | null) => void);
}

interface QuizViewerProps extends QuizSessionState {
  selectedQuiz: QuizMetadata;
  activeQuiz: Quiz | null;
  activeWorksheet: Worksheet | null;
  activeQuestionDocument: QuestionDocument | null;
  loadingActiveQuiz: boolean;
  resetKey: number;
  onReset: () => void;
  onSchedule: () => void;
}

export function QuizViewer({
  selectedQuiz,
  activeQuiz,
  activeWorksheet,
  activeQuestionDocument,
  loadingActiveQuiz,
  resetKey,
  onReset,
  onSchedule,
  answers,
  setAnswers,
  visibleCount,
  ensureQuestionVisible,
  totalQuestions,
  answeredCount,
  correctCount,
  isAllAnswered,
  lastQuestionElementRef,
}: QuizViewerProps) {
  const topic = selectedQuiz.topic || DEFAULT_TOPIC;

  const openTopic = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const path = selectedQuiz.path.replace(/\\/g, "/");
    void openUrl(`obsidian://open?path=${encodeURIComponent(path)}`);
  };

  return (
    <div className="quiz-viewer">
      <div className="quiz-question-toolbar">
        <div className="quiz-header">
          <div className="header-title-row">
            <h1>
              {selectedQuiz.title.includes("_") &&
              !selectedQuiz.title.includes(" ")
                ? selectedQuiz.title.replace(/_/g, " ")
                : selectedQuiz.title}
            </h1>
          </div>
        </div>
        <div className="quiz-meta-row quiz-meta-row--sticky">
          <div className="quiz-meta-info">
            <p className="quiz-topic-line">
              Topic:{" "}
              <a
                href="#"
                aria-label={`Open topic ${topic}`}
                onClick={openTopic}
              >
                {topic}
              </a>
            </p>
            <p className="quiz-progress-line">
              {selectedQuiz.is_worksheet
                ? "Worksheet"
                : selectedQuiz.is_question
                  ? "Open questions"
                  : `${answeredCount} of ${totalQuestions} answered`}
            </p>
          </div>
          <div className="quiz-header-actions">
            <button
              className="button-secondary"
              onClick={onReset}
              title="Reset Quiz"
            >
              <svg
                className="quiz-action-icon"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 4v5h5" />
              </svg>
              Reset
            </button>
            <button className="button-primary" onClick={onSchedule}>
              <svg
                className="quiz-action-icon"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M8 2v4M16 2v4M3 10h18" />
                <path d="M12 14v4M10 16h4" />
              </svg>
              Schedule
            </button>
          </div>
        </div>
      </div>

      <div className="quiz-question-content">
        {loadingActiveQuiz ? (
          <StatusView compact kind="loading">
            Loading content...
          </StatusView>
        ) : activeWorksheet ? (
          <WorksheetViewer
            key={`${activeWorksheet.path}-${resetKey}`}
            worksheet={activeWorksheet}
          />
        ) : activeQuestionDocument ? (
          <QuestionViewer
            key={`${activeQuestionDocument.path}-${resetKey}`}
            document={activeQuestionDocument}
          />
        ) : activeQuiz ? (
          <QuizQuestions
            quiz={activeQuiz}
            answers={answers}
            setAnswers={setAnswers}
            visibleCount={visibleCount}
            ensureQuestionVisible={ensureQuestionVisible}
            resetKey={resetKey}
            lastQuestionElementRef={lastQuestionElementRef}
            isAllAnswered={isAllAnswered}
            correctCount={correctCount}
            totalQuestions={totalQuestions}
          />
        ) : (
          <StatusView compact kind="error">
            Failed to load quiz content.
          </StatusView>
        )}
      </div>
    </div>
  );
}

interface QuizQuestionsProps {
  quiz: Quiz;
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  visibleCount: number;
  ensureQuestionVisible: (questionIndex: number) => void;
  resetKey: number;
  lastQuestionElementRef:
    | RefObject<HTMLDivElement | null>
    | ((node: HTMLDivElement | null) => void);
  isAllAnswered: boolean;
  correctCount: number;
  totalQuestions: number;
}

function QuizQuestions({
  quiz,
  answers,
  setAnswers,
  visibleCount,
  ensureQuestionVisible,
  resetKey,
  lastQuestionElementRef,
  isAllAnswered,
  correctCount,
  totalQuestions,
}: QuizQuestionsProps) {
  const [navigationTargetIndex, setNavigationTargetIndex] = useState<
    number | null
  >(null);
  const questionCardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (navigationTargetIndex === null) return;
    if (navigationTargetIndex >= visibleCount) {
      ensureQuestionVisible(navigationTargetIndex);
      return;
    }

    const targetCard = questionCardRefs.current[navigationTargetIndex] ?? null;
    const targetOption =
      targetCard?.querySelector<HTMLButtonElement>(
        ".option-button:not(:disabled)",
      ) ?? null;
    focusAndCenter(targetOption, targetCard);
    setNavigationTargetIndex(null);
  }, [ensureQuestionVisible, navigationTargetIndex, visibleCount]);

  const handleAnswer = (questionIndex: number, letter: string) => {
    const question = quiz.questions[questionIndex];
    if (!question) return;

    setAnswers((previous) => ({
      ...previous,
      [question.id]: letter,
    }));

    const nextUnansweredIndex = quiz.questions.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > questionIndex && answers[candidate.id] === undefined,
    );
    setNavigationTargetIndex(
      nextUnansweredIndex === -1 ? null : nextUnansweredIndex,
    );
  };

  return (
    <>
      <div className="questions-container">
        {quiz.questions.slice(0, visibleCount).map((question, index) => {
          const card = (
            <QuestionCard
              key={`${quiz.path}-${question.id}-${resetKey}`}
              question={question}
              selectedLetter={answers[question.id]}
              onAnswer={(_, letter) => handleAnswer(index, letter)}
              cardRef={(card) => {
                questionCardRefs.current[index] = card;
              }}
            />
          );
          return index === visibleCount - 1 ? (
            <div
              ref={lastQuestionElementRef}
              key={`${quiz.path}-${question.id}-${resetKey}-wrapper`}
            >
              {card}
            </div>
          ) : (
            <div key={`${quiz.path}-${question.id}-${resetKey}`}>{card}</div>
          );
        })}
      </div>
      {isAllAnswered && (
        <QuizReview
          quiz={quiz}
          answers={answers}
          correctCount={correctCount}
          totalQuestions={totalQuestions}
        />
      )}
    </>
  );
}

function QuizReview({
  quiz,
  answers,
  correctCount,
  totalQuestions,
}: Omit<
  QuizQuestionsProps,
  | "setAnswers"
  | "visibleCount"
  | "ensureQuestionVisible"
  | "resetKey"
  | "lastQuestionElementRef"
  | "isAllAnswered"
>) {
  return (
    <div className="quiz-summary">
      <h2 className="quiz-summary-title">Quiz Review</h2>
      <p className="quiz-summary-score">
        You scored {correctCount} out of {totalQuestions} (
        {Math.round((correctCount / totalQuestions) * 100)}%)
      </p>
      <div className="quiz-review-list">
        {quiz.questions.map((question) => {
          const selected = answers[question.id];
          const isCorrect = selected === question.correct_answer;
          return (
            <div
              key={`review-${question.id}`}
              className={`quiz-review-item ${isCorrect ? "correct" : "incorrect"}`}
            >
              <strong className="quiz-review-question">
                {question.id}. {question.text}
              </strong>
              <div className="quiz-review-answer">
                Your answer: <strong>{selected}</strong>{" "}
                <StatusIcon kind={isCorrect ? "success" : "error"} />{" "}
                {!isCorrect && (
                  <span>
                    (Correct: <strong>{question.correct_answer}</strong>)
                  </span>
                )}
              </div>
              {question.explanation && (
                <div className="quiz-review-explanation">
                  Explanation: {question.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
