import { Fragment, type ReactNode, useState } from "react";
import type { QuestionDocument } from "../types";
import "./QuestionViewer.css";

interface QuestionViewerProps {
  document: QuestionDocument;
}

const renderInline = (text: string): ReactNode[] =>
  text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });

function MarkdownContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index++;
      while (
        index < lines.length &&
        !lines[index].trimStart().startsWith("```")
      ) {
        code.push(lines[index++].replace(/^ {0,3}/, ""));
      }
      if (index < lines.length) index++;
      blocks.push(
        <pre className="question-code-block" key={`code-${blocks.length}`}>
          <code className={language ? `language-${language}` : undefined}>
            {code.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }

    if (/^\s*(?:\d+\.|[-*+])\s+/.test(line)) {
      const items: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !lines[index].trimStart().startsWith("```")
      ) {
        items.push(lines[index++]);
      }
      const ordered = /^\s*\d+\.\s+/.test(items[0]);
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={`list-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>
              {renderInline(item.replace(/^\s*(?:\d+\.|[-*+])\s+/, "").trim())}
            </li>
          ))}
        </List>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trimStart().startsWith("```") &&
      !/^\s*(?:\d+\.|[-*+])\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index++].trim());
    }
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  return <>{blocks}</>;
}

export function QuestionViewer({ document }: QuestionViewerProps) {
  return <QuestionBody document={document} key={document.path} />;
}

function QuestionBody({ document }: QuestionViewerProps) {
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(
    () => new Set(),
  );

  const toggleAnswer = (id: number) => {
    setRevealedAnswers((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="question-document-viewer">
      <p className="question-document-intro">
        Write your response, then reveal each suggested answer when you are
        ready.
      </p>
      {document.questions.map((entry) => {
        const isRevealed = revealedAnswers.has(entry.id);
        return (
          <section className="question-document-card" key={entry.id}>
            <h2>Question {entry.id}</h2>
            <div className="question-document-content">
              <MarkdownContent content={entry.question} />
            </div>
            <label className="question-response-label">
              Your response
              <textarea
                aria-label={`Response to question ${entry.id}`}
                className="question-document-response"
                placeholder="Write your response here…"
                value={responses[entry.id] ?? ""}
                onChange={(event) =>
                  setResponses((previous) => ({
                    ...previous,
                    [entry.id]: event.target.value,
                  }))
                }
              />
            </label>
            <button
              aria-expanded={isRevealed}
              className="button-secondary"
              onClick={() => toggleAnswer(entry.id)}
              type="button"
            >
              {isRevealed
                ? `Hide suggested answer ${entry.id}`
                : `Reveal suggested answer ${entry.id}`}
            </button>
            {isRevealed && (
              <div className="question-suggested-answer">
                <h3>Suggested answer</h3>
                <div className="question-document-content">
                  <MarkdownContent content={entry.answer} />
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
