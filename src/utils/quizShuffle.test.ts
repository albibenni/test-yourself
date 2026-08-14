import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "../types";
import { shuffleQuizQuestions } from "./quizShuffle";

const question: QuizQuestion = {
  id: "1",
  text: "Which city is the capital of France?",
  options: [
    { letter: "A", text: "London" },
    { letter: "B", text: "Paris" },
    { letter: "C", text: "Berlin" },
    { letter: "D", text: "Madrid" },
  ],
  correct_answer: "B",
  explanation: "Paris is the capital of France.",
};

const secondQuestion: QuizQuestion = {
  id: "2",
  text: "Which planet is known as the Red Planet?",
  options: [
    { letter: "A", text: "Venus" },
    { letter: "B", text: "Earth" },
    { letter: "C", text: "Jupiter" },
    { letter: "D", text: "Mars" },
  ],
  correct_answer: "D",
  explanation: "Mars appears red because of iron oxides in its surface dust.",
};

describe("shuffleQuizQuestions", () => {
  it("reorders options, relabels them, and remaps the correct answer", () => {
    const shuffled = shuffleQuizQuestions([question], () => 0)[0]!;

    expect(shuffled.options).toEqual([
      { letter: "A", text: "Paris" },
      { letter: "B", text: "Berlin" },
      { letter: "C", text: "Madrid" },
      { letter: "D", text: "London" },
    ]);
    expect(shuffled.correct_answer).toBe("A");
  });

  it("does not mutate the parsed quiz data", () => {
    const original = structuredClone(question);

    shuffleQuizQuestions([question], () => 0);

    expect(question).toEqual(original);
  });

  it("does not leave a multi-option question visibly unchanged", () => {
    const shuffled = shuffleQuizQuestions([question], () => 0.999)[0]!;

    expect(shuffled.options.map((option) => option.text)).not.toEqual(
      question.options.map((option) => option.text),
    );
  });

  it("keeps answer keys and explanations attached to each question", () => {
    const [firstQuestion, shuffledSecondQuestion] = shuffleQuizQuestions(
      [question, secondQuestion],
      () => 0,
    );

    expect(firstQuestion).toMatchObject({
      correct_answer: "A",
      explanation: "Paris is the capital of France.",
    });
    expect(firstQuestion!.options[0]).toEqual({ letter: "A", text: "Paris" });
    expect(firstQuestion!.options[3]).toEqual({
      letter: "D",
      text: "London",
    });
    expect(shuffledSecondQuestion).toMatchObject({
      correct_answer: "C",
      explanation:
        "Mars appears red because of iron oxides in its surface dust.",
    });
    expect(shuffledSecondQuestion!.options[0]).toEqual({
      letter: "A",
      text: "Earth",
    });
    expect(shuffledSecondQuestion!.options[2]).toEqual({
      letter: "C",
      text: "Mars",
    });
  });
});
