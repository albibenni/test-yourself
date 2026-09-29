import { describe, expect, it } from "vitest";
import { QuizSchema } from "./schemas";

describe("QuizSchema", () => {
  it("rejects duplicate question IDs", () => {
    const question = {
      id: "1",
      text: "Question",
      options: [{ letter: "A", text: "Answer" }],
      correct_answer: "A",
      explanation: "Explanation",
    };

    const result = QuizSchema.safeParse({
      title: "Duplicate IDs",
      path: "/quizzes/duplicates.md",
      topic: "Testing",
      questions: [question, { ...question, text: "Another question" }],
      last_modified: 0,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: "Question IDs must be unique",
        path: ["questions", 1, "id"],
      }),
    );
  });
});
