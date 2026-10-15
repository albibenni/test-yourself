import { describe, expect, it } from "vite-plus/test";

import {
  CreationSearchPageSchema,
  DirectoryListingSchema,
  QuizSchema,
  ThemePreferencesSchema,
} from "./schemas";

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

describe("external boundary schemas", () => {
  it("rejects malformed nested Tauri response data", () => {
    expect(
      CreationSearchPageSchema.safeParse({
        items: [{ name: "Quiz", path: 42, relative_path: "Quiz.md" }],
        has_more: false,
      }).success,
    ).toBe(false);
    expect(
      DirectoryListingSchema.safeParse({
        current_path: "/quizzes",
        parent_path: null,
        items: [{ name: "Quiz", path: "/quizzes", md_count: -1 }],
      }).success,
    ).toBe(false);
  });

  it("normalizes invalid persisted preferences to defaults", () => {
    expect(
      ThemePreferencesSchema.parse({
        theme: "sepia",
        accent: null,
        textColor: 1,
        textScale: "huge",
        contrast: false,
        reducedMotion: "always",
      }),
    ).toEqual({
      theme: "system",
      accent: "blue",
      textColor: "slate",
      textScale: "default",
      contrast: "system",
      reducedMotion: "system",
    });
  });
});
