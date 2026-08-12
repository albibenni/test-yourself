import { openUrl } from "@tauri-apps/plugin-opener";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { DEFAULT_TOPIC } from "../constants";
import type { Quiz, QuizMetadata, Worksheet } from "../types";
import { QuestionCard } from "./QuestionCard";
import { WorksheetViewer } from "./WorksheetViewer";

interface QuizSessionState {
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  visibleCount: number;
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
  loadingActiveQuiz: boolean;
  resetKey: number;
  onReset: () => void;
  onSchedule: () => void;
}

export function QuizViewer({
  selectedQuiz,
  activeQuiz,
  activeWorksheet,
  loadingActiveQuiz,
  resetKey,
  onReset,
  onSchedule,
  answers,
  setAnswers,
  visibleCount,
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
      <div className="quiz-header">
        <div className="header-title-row">
          <h1>
            {selectedQuiz.title.includes("_") &&
            !selectedQuiz.title.includes(" ")
              ? selectedQuiz.title.replace(/_/g, " ")
              : selectedQuiz.title}
          </h1>
          <div className="quiz-header-actions">
            <button
              className="button-secondary"
              onClick={onReset}
              title="Reset Quiz"
            >
              ↻ Reset
            </button>
            <button className="button-primary" onClick={onSchedule}>
              ▣ Schedule
            </button>
          </div>
        </div>
        <div className="quiz-meta-info">
          <p className="quiz-topic-line">
            Topic:{" "}
            <a href="#" aria-label={`Open topic ${topic}`} onClick={openTopic}>
              {topic}
            </a>
          </p>
          <p className="quiz-progress-line">
            {selectedQuiz.is_worksheet
              ? "Worksheet"
              : `${answeredCount} of ${totalQuestions} answered`}
          </p>
        </div>
      </div>

      {loadingActiveQuiz ? (
        <StatusMessage>Loading content...</StatusMessage>
      ) : activeWorksheet ? (
        <WorksheetViewer
          key={`${activeWorksheet.path}-${resetKey}`}
          worksheet={activeWorksheet}
        />
      ) : activeQuiz ? (
        <QuizQuestions
          quiz={activeQuiz}
          answers={answers}
          setAnswers={setAnswers}
          visibleCount={visibleCount}
          resetKey={resetKey}
          lastQuestionElementRef={lastQuestionElementRef}
          isAllAnswered={isAllAnswered}
          correctCount={correctCount}
          totalQuestions={totalQuestions}
        />
      ) : (
        <StatusMessage error>Failed to load quiz content.</StatusMessage>
      )}
    </div>
  );
}

function StatusMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      style={{
        padding: "2rem",
        textAlign: "center",
        color: error ? "var(--error-color)" : "var(--text-secondary)",
      }}
    >
      {children}
    </div>
  );
}

interface QuizQuestionsProps {
  quiz: Quiz;
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  visibleCount: number;
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
  resetKey,
  lastQuestionElementRef,
  isAllAnswered,
  correctCount,
  totalQuestions,
}: QuizQuestionsProps) {
  return (
    <>
      <div className="questions-container">
        {quiz.questions.slice(0, visibleCount).map((question, index) => {
          const card = (
            <QuestionCard
              key={`${quiz.path}-${question.id}-${resetKey}`}
              question={question}
              onAnswer={(_, letter) =>
                setAnswers((previous) => ({
                  ...previous,
                  [question.id]: letter,
                }))
              }
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
  | "resetKey"
  | "lastQuestionElementRef"
  | "isAllAnswered"
>) {
  return (
    <div
      className="quiz-summary"
      style={{
        marginTop: "3rem",
        padding: "1.5rem",
        backgroundColor: "var(--bg-secondary)",
        borderRadius: "8px",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Quiz Review</h2>
      <p
        style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "1.5rem" }}
      >
        You scored {correctCount} out of {totalQuestions} (
        {Math.round((correctCount / totalQuestions) * 100)}%)
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {quiz.questions.map((question) => {
          const selected = answers[question.id];
          const isCorrect = selected === question.correct_answer;
          return (
            <div
              key={`review-${question.id}`}
              style={{
                padding: "1rem",
                borderLeft: `4px solid ${isCorrect ? "var(--success-color)" : "var(--error-color)"}`,
                backgroundColor: "var(--bg-primary)",
                borderRadius: "4px",
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                {question.id}. {question.text}
              </strong>
              <div style={{ marginBottom: "0.5rem" }}>
                Your answer: <strong>{selected}</strong>{" "}
                {isCorrect ? "✨" : "❌"}{" "}
                {!isCorrect && (
                  <span style={{ marginLeft: "0.5rem" }}>
                    (Correct: <strong>{question.correct_answer}</strong>)
                  </span>
                )}
              </div>
              {question.explanation && (
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                    marginTop: "0.5rem",
                  }}
                >
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
