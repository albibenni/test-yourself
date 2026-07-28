import React, { useState, useMemo } from "react";
import type { Worksheet } from "../types";
import "./WorksheetViewer.css";

interface WorksheetViewerProps {
  worksheet: Worksheet;
}

export function WorksheetViewer({ worksheet }: WorksheetViewerProps) {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  // Parse the content and split by {{answer}} tags
  const { parts, correctAnswers } = useMemo(() => {
    const regex = /\{\{([^}]+)\}\}/g;
    const parts: { type: "text" | "blank"; content: string; index?: number }[] =
      [];
    const correctAnswers: string[] = [];

    let lastIndex = 0;
    let match;
    let blankIndex = 0;

    while ((match = regex.exec(worksheet.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: worksheet.content.substring(lastIndex, match.index),
        });
      }

      const answer = match[1].trim();
      correctAnswers.push(answer);

      parts.push({
        type: "blank",
        content: answer,
        index: blankIndex,
      });

      blankIndex++;
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < worksheet.content.length) {
      parts.push({
        type: "text",
        content: worksheet.content.substring(lastIndex),
      });
    }

    return { parts, correctAnswers };
  }, [worksheet.content]);

  const handleInputChange = (index: number, value: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    correctAnswers.forEach((ans, idx) => {
      if (userAnswers[idx]?.toLowerCase().trim() === ans.toLowerCase()) {
        correct++;
      }
    });
    return correct;
  };

  const reset = () => {
    setUserAnswers({});
    setShowResults(false);
  };

  return (
    <div className="worksheet-viewer">
      <div className="worksheet-content">
        {parts.map((part, i) => {
          if (part.type === "text") {
            // Very basic markdown rendering for newlines and bold (could be expanded)
            return (
              <span key={`part-${i}`} className="worksheet-text">
                {part.content.split("\n").map((line, j) => (
                  <React.Fragment key={`line-${j}`}>
                    {j > 0 && <br />}
                    {line.split(/(\*\*.*?\*\*)/g).map((segment, k) => {
                      if (segment.startsWith("**") && segment.endsWith("**")) {
                        return (
                          <strong key={`bold-${k}`}>
                            {segment.slice(2, -2)}
                          </strong>
                        );
                      }
                      return <span key={`text-${k}`}>{segment}</span>;
                    })}
                  </React.Fragment>
                ))}
              </span>
            );
          } else if (part.type === "blank" && part.index !== undefined) {
            const isCorrect = showResults
              ? userAnswers[part.index]?.toLowerCase().trim() ===
                part.content.toLowerCase()
              : null;

            return (
              <span
                key={`blank-${part.index}`}
                className="worksheet-blank-container"
              >
                <input
                  type="text"
                  className={`worksheet-input ${showResults ? (isCorrect ? "correct" : "incorrect") : ""}`}
                  value={userAnswers[part.index] || ""}
                  onChange={(e) =>
                    handleInputChange(part.index!, e.target.value)
                  }
                  disabled={showResults}
                  style={{
                    width: `${Math.max(part.content.length * 10, 60)}px`,
                  }}
                />
                {showResults && !isCorrect && (
                  <span className="worksheet-correction">{part.content}</span>
                )}
              </span>
            );
          }
          return null;
        })}
      </div>

      <div className="worksheet-actions">
        {!showResults ? (
          <button
            className="button-primary"
            onClick={() => setShowResults(true)}
          >
            Check Answers
          </button>
        ) : (
          <div className="worksheet-results">
            <div className="score">
              Score: {calculateScore()} / {correctAnswers.length}
            </div>
            <button className="button-secondary" onClick={reset}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
