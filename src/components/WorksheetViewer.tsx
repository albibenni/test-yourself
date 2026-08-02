import React, { useMemo, useState } from "react";
import type { Worksheet } from "../types";
import "./WorksheetViewer.css";

const normalizeAnswer = (ans: string | undefined) => {
  if (!ans) return "";
  return ans
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const checkAnswer = (
  userAns: string | undefined,
  correctAnsContent: string,
) => {
  if (!userAns) return false;
  const normalizedUser = normalizeAnswer(userAns);
  if (!normalizedUser) return false;

  const options = correctAnsContent.split("|").map(normalizeAnswer);

  return options.some((opt) => {
    if (opt === normalizedUser) return true;
    if (opt.length > 3) {
      const distance = getLevenshteinDistance(normalizedUser, opt);
      if (distance <= 1) return true;
    }
    return false;
  });
};

interface WorksheetViewerProps {
  worksheet: Worksheet;
}

export function WorksheetViewer({ worksheet }: WorksheetViewerProps) {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

  // Parse the content and split by numbered questions
  const { questions, correctAnswers } = useMemo(() => {
    // Split the content by numbered list items (e.g., "1. ", "2. ")
    const blocks = worksheet.content
      .split(/(?=(?:^|\n)\s*\d+\.\s+)/)
      .filter((block) => block.trim().length > 0);

    const questionsList: {
      id: string;
      sections: {
        isCode: boolean;
        language: string;
        parts: { type: "text" | "blank"; content: string; index?: number }[];
      }[];
      isNumbered: boolean;
      blankIndices: number[];
      explanation?: string;
    }[] = [];
    const correctAnswersList: string[] = [];
    let globalBlankIndex = 0;

    blocks.forEach((block, index) => {
      const match = block.match(/^(?:\n)?\s*(\d+)\.\s+(.*)/s);
      let id = "";
      let contentToParse = block;
      let isNumbered = false;

      if (match) {
        id = match[1];
        contentToParse = match[2];
        isNumbered = true;
      } else {
        id = `section-${index}`;
      }

      let explanation = "";
      const expMatch = contentToParse.match(
        /(?:\n|^)> (?:\[!info\] )?Explanation:?\s*([\s\S]*)$/i,
      );
      if (expMatch) {
        explanation = expMatch[1]
          .split("\n")
          .map((line) => line.replace(/^> ?/, ""))
          .join("\n")
          .trim();
        contentToParse = contentToParse.substring(0, expMatch.index).trim();
      }

      const rawSections = contentToParse.split(/(```[\s\S]*?```)/g);
      const questionBlankIndices: number[] = [];

      const sections = rawSections.map((sectionStr) => {
        const isCode =
          sectionStr.startsWith("```") && sectionStr.endsWith("```");
        let actualText = sectionStr;
        let language = "";

        if (isCode) {
          const codeMatch = sectionStr.match(
            /^```([a-zA-Z]*)\n?([\s\S]*?)```$/,
          );
          if (codeMatch) {
            language = codeMatch[1];
            actualText = codeMatch[2];
          } else {
            actualText = sectionStr.substring(3, sectionStr.length - 3);
          }
        }

        const regex = /\{\{([^}]+)\}\}/g;
        const parts: {
          type: "text" | "blank";
          content: string;
          index?: number;
        }[] = [];
        let lastIndex = 0;
        let m;

        while ((m = regex.exec(actualText)) !== null) {
          if (m.index > lastIndex) {
            parts.push({
              type: "text",
              content: actualText.substring(lastIndex, m.index),
            });
          }

          const answer = m[1].trim();
          correctAnswersList.push(answer);

          parts.push({
            type: "blank",
            content: answer,
            index: globalBlankIndex,
          });

          questionBlankIndices.push(globalBlankIndex);
          globalBlankIndex++;
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < actualText.length) {
          parts.push({
            type: "text",
            content: actualText.substring(lastIndex),
          });
        }

        return { isCode, language, parts };
      });

      questionsList.push({
        id,
        sections,
        isNumbered,
        blankIndices: questionBlankIndices,
        explanation,
      });
    });

    return { questions: questionsList, correctAnswers: correctAnswersList };
  }, [worksheet.content]);

  const [checkedQuestions, setCheckedQuestions] = useState<
    Record<number, boolean>
  >({});

  const handleInputChange = (index: number, value: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const handleCheckQuestion = (qIndex: number) => {
    setCheckedQuestions((prev) => ({ ...prev, [qIndex]: true }));
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    qIndex: number,
  ) => {
    if (e.key === "Enter") {
      const q = questions[qIndex];
      const allFilled = q.blankIndices.every(
        (idx) => (userAnswers[idx] || "").trim().length > 0,
      );
      if (allFilled) {
        handleCheckQuestion(qIndex);
      }
    }
  };

  const handleCheckAll = () => {
    const allChecked: Record<number, boolean> = {};
    questions.forEach((_, i) => {
      allChecked[i] = true;
    });
    setCheckedQuestions(allChecked);
  };

  const reset = () => {
    setUserAnswers({});
    setCheckedQuestions({});
  };

  const calculateScore = () => {
    let correct = 0;
    correctAnswers.forEach((ans, idx) => {
      if (checkAnswer(userAnswers[idx], ans)) {
        correct++;
      }
    });
    return correct;
  };

  const totalQuestionsWithBlanks = questions.filter(
    (q) => q.blankIndices.length > 0,
  ).length;
  const isAllChecked =
    totalQuestionsWithBlanks > 0 &&
    Object.keys(checkedQuestions).length >= totalQuestionsWithBlanks;

  const renderParts = (
    parts: { type: "text" | "blank"; content: string; index?: number }[],
    isCode: boolean,
    qIndex: number,
  ) => {
    const isQuestionChecked = checkedQuestions[qIndex];

    return parts.map((part, i) => {
      if (part.type === "text") {
        if (isCode) {
          return <span key={`part-${i}`}>{part.content}</span>;
        }
        return (
          <span key={`part-${i}`} className="worksheet-text">
            {part.content.split("\n").map((line, j) => (
              <React.Fragment key={`line-${j}`}>
                {j > 0 && <br />}
                {line.split(/(\*\*.*?\*\*)/g).map((segment, k) => {
                  if (segment.startsWith("**") && segment.endsWith("**")) {
                    return (
                      <strong key={`bold-${k}`}>{segment.slice(2, -2)}</strong>
                    );
                  }
                  return <span key={`text-${k}`}>{segment}</span>;
                })}
              </React.Fragment>
            ))}
          </span>
        );
      } else if (part.type === "blank" && part.index !== undefined) {
        const isCorrect = isQuestionChecked
          ? checkAnswer(userAnswers[part.index], part.content)
          : null;

        return (
          <span
            key={`blank-${part.index}`}
            className="worksheet-blank-container"
          >
            <input
              type="text"
              className={`worksheet-input ${isQuestionChecked ? (isCorrect ? "correct" : "incorrect") : ""}`}
              value={userAnswers[part.index] || ""}
              onChange={(e) => handleInputChange(part.index!, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, qIndex)}
              disabled={isQuestionChecked}
              style={{ width: `${Math.max(part.content.length * 10, 60)}px` }}
            />
            {isQuestionChecked && !isCorrect && (
              <span className="worksheet-correction">{part.content}</span>
            )}
          </span>
        );
      }
      return null;
    });
  };

  return (
    <div className="worksheet-viewer">
      <div className="questions-container">
        {questions.map((q, qIndex) => {
          const isQuestionChecked = checkedQuestions[qIndex];
          const allFilled =
            q.blankIndices.length > 0 &&
            q.blankIndices.every(
              (idx) => (userAnswers[idx] || "").trim().length > 0,
            );

          return (
            <div
              key={`q-${qIndex}`}
              className={q.isNumbered ? "question-card" : "worksheet-content"}
            >
              {q.isNumbered && (
                <div
                  className="header-title-row"
                  style={{
                    justifyContent: "space-between",
                    marginBottom: "1rem",
                  }}
                >
                  <h3 className="question-title" style={{ margin: 0 }}>
                    {q.id}.
                  </h3>
                  {!isQuestionChecked && q.blankIndices.length > 0 && (
                    <button
                      className="button-secondary"
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.85rem",
                      }}
                      onClick={() => handleCheckQuestion(qIndex)}
                      disabled={!allFilled}
                    >
                      Check
                    </button>
                  )}
                </div>
              )}
              {!q.isNumbered &&
                !isQuestionChecked &&
                q.blankIndices.length > 0 && (
                  <div style={{ textAlign: "right", marginBottom: "0.5rem" }}>
                    <button
                      className="button-secondary"
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.85rem",
                      }}
                      onClick={() => handleCheckQuestion(qIndex)}
                      disabled={!allFilled}
                    >
                      Check
                    </button>
                  </div>
                )}
              <div className={q.isNumbered ? "worksheet-phrase" : ""}>
                {q.sections.map((section, sIndex) => {
                  if (section.isCode) {
                    return (
                      <pre
                        key={`sec-${sIndex}`}
                        className="worksheet-code-block"
                      >
                        <code>{renderParts(section.parts, true, qIndex)}</code>
                      </pre>
                    );
                  }
                  return (
                    <span key={`sec-${sIndex}`}>
                      {renderParts(section.parts, false, qIndex)}
                    </span>
                  );
                })}
              </div>

              {isQuestionChecked && q.explanation && (
                <div
                  className="worksheet-explanation"
                  style={{
                    marginTop: "1.5rem",
                    padding: "1rem",
                    backgroundColor:
                      "color-mix(in srgb, var(--accent-color) 10%, transparent)",
                    borderLeft: "4px solid var(--accent-color)",
                    borderRadius: "0 8px 8px 0",
                    fontSize: "0.95rem",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "var(--accent-color)",
                    }}
                  >
                    Explanation:
                  </strong>
                  <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {q.explanation}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalQuestionsWithBlanks > 0 && (
        <div className="worksheet-actions">
          {!isAllChecked ? (
            <button className="button-primary" onClick={handleCheckAll}>
              Check All Answers
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
      )}
    </div>
  );
}
