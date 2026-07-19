import { useState } from "react";
import { clsx } from "clsx";
import type { QuizQuestion } from "../types";

interface QuestionCardProps {
  question: QuizQuestion;
  onAnswer?: (isCorrect: boolean, selectedLetter: string) => void;
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const isAnswered = selectedLetter !== null;
  const isCorrect = selectedLetter === question.correct_answer;

  const handleSelect = (letter: string) => {
    if (isAnswered) return;
    setSelectedLetter(letter);
    if (onAnswer) {
      onAnswer(letter === question.correct_answer, letter);
    }
  };

  return (
    <div className="question-card">
      <h3 className="question-title">
        {question.id}. {question.text}
      </h3>
      <div className="options-list">
        {question.options.map((opt) => {
          return (
            <button
              key={opt.letter}
              className={clsx(
                "option-button",
                isAnswered &&
                  opt.letter === question.correct_answer &&
                  "correct",
                isAnswered &&
                  opt.letter === selectedLetter &&
                  opt.letter !== question.correct_answer &&
                  "incorrect",
              )}
              onClick={() => handleSelect(opt.letter)}
              disabled={isAnswered}
            >
              <span className="option-letter">{opt.letter}.</span>
              <span className="option-text">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div
          className={clsx("feedback-block", isCorrect ? "success" : "error")}
        >
          <div className="feedback-title">
            {isCorrect ? "✨ Correct!" : "❌ Incorrect"}
          </div>
          {question.explanation && (
            <div className="feedback-explanation">{question.explanation}</div>
          )}
          {!isCorrect && !question.explanation && (
            <div className="feedback-explanation">
              The correct answer is {question.correct_answer}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
