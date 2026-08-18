import { type ReactNode, useMemo, useState } from "react";
import type { Scenario } from "../types";
import "./ScenarioViewer.css";

interface ScenarioViewerProps {
  scenario: Scenario;
}

interface Section {
  title: string;
  content: string;
}

const splitSections = (content: string): Section[] => {
  const matches = [...content.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) return [{ title: "Scenario", content }];

  return matches.map((match, index) => ({
    title: match[1].trim(),
    content: content
      .slice(match.index! + match[0].length, matches[index + 1]?.index)
      .trim(),
  }));
};

const renderInline = (text: string): ReactNode[] =>
  text
    .split(/(`[^`]+`)/g)
    .map((part, index) =>
      part.startsWith("`") && part.endsWith("`") ? (
        <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );

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
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index++]);
      }
      index++;
      blocks.push(
        <pre className="scenario-code-block" key={`code-${blocks.length}`}>
          <code className={language ? `language-${language}` : undefined}>
            {code.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s/, ""));
        index++;
      }
      blocks.push(
        <ol key={`list-${blocks.length}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("```") &&
      !/^\d+\.\s/.test(lines[index])
    ) {
      paragraph.push(lines[index++]);
    }
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  return <>{blocks}</>;
}

export function ScenarioViewer({ scenario }: ScenarioViewerProps) {
  return <ScenarioBody key={scenario.path} scenario={scenario} />;
}

function ScenarioBody({ scenario }: ScenarioViewerProps) {
  const sections = useMemo(() => splitSections(scenario.content), [scenario]);
  const answerKey = sections.find((section) =>
    /^(answer key|model answer|solution)$/i.test(section.title),
  );
  const prompts = sections.filter((section) => section !== answerKey);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [answerVisible, setAnswerVisible] = useState(false);

  return (
    <div className="scenario-viewer">
      <p className="scenario-intro">
        Work through the evidence before revealing the answer key.
      </p>
      {prompts.map((section, index) => (
        <section className="scenario-section" key={section.title}>
          <h2>{section.title}</h2>
          <div className="scenario-content">
            <MarkdownContent content={section.content} />
          </div>
          {/^(your response|response|diagnosis|decision)$/i.test(
            section.title,
          ) && (
            <textarea
              aria-label={section.title}
              className="scenario-response"
              placeholder="Write your reasoning here…"
              value={responses[index] ?? ""}
              onChange={(event) =>
                setResponses((previous) => ({
                  ...previous,
                  [index]: event.target.value,
                }))
              }
            />
          )}
        </section>
      ))}
      {answerKey && (
        <section className="scenario-answer-key">
          <button
            className="button-secondary"
            type="button"
            onClick={() => setAnswerVisible((visible) => !visible)}
            aria-expanded={answerVisible}
          >
            {answerVisible ? "Hide answer key" : "Reveal answer key"}
          </button>
          {answerVisible && (
            <div className="scenario-answer-content">
              <h2>{answerKey.title}</h2>
              <div className="scenario-content">
                <MarkdownContent content={answerKey.content} />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
