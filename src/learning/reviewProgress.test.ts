import { describe, expect, it } from "vite-plus/test";

import {
  calculateReviewCompletion,
  completeAndSaveReview,
  getReviewSet,
  LearningDataSchema,
  loadLearningData,
} from "./reviewProgress";

const allQuestionIds = ["1", "2", "3"];
const now = new Date(2026, 9, 15, 12);

describe("calculateReviewCompletion", () => {
  it("recommends an incorrect-only review tomorrow after an initial error", () => {
    const completion = calculateReviewCompletion({
      allQuestionIds,
      assessments: { "1": "correct", "2": "incorrect", "3": "partial" },
      currentState: undefined,
      now,
      scope: "full",
    });

    expect(completion.recommendation).toMatchObject({
      dueDate: "2026-10-16",
      intervalDays: 1,
      questionIds: ["2", "3"],
      scope: "incorrect",
    });
    expect(completion.state).toMatchObject({
      pendingIncorrectIds: ["2", "3"],
      resumeIntervalDays: 3,
      status: "remediation",
    });
  });

  it("recommends the full suite in three days after remediation succeeds", () => {
    const completion = calculateReviewCompletion({
      allQuestionIds,
      assessments: { "2": "correct", "3": "correct" },
      currentState: {
        currentIntervalDays: null,
        pendingIncorrectIds: ["2", "3"],
        resumeIntervalDays: 3,
        status: "remediation",
      },
      now,
      scope: "incorrect",
    });

    expect(completion.recommendation).toMatchObject({
      dueDate: "2026-10-18",
      intervalDays: 3,
      questionIds: allQuestionIds,
      scope: "full",
    });
  });

  it.each([
    [null, 3],
    [3, 7],
    [7, 14],
    [14, 30],
    [30, 30],
  ] as const)(
    "advances a successful full review from %s to %s days",
    (currentIntervalDays, expectedIntervalDays) => {
      const completion = calculateReviewCompletion({
        allQuestionIds,
        assessments: { "1": "correct", "2": "correct", "3": "correct" },
        currentState: {
          currentIntervalDays,
          pendingIncorrectIds: [],
          resumeIntervalDays: null,
          status: "scheduled-full",
        },
        now,
        scope: "full",
      });

      expect(completion.recommendation.intervalDays).toBe(expectedIntervalDays);
      expect(completion.recommendation.scope).toBe("full");
    },
  );

  it.each([
    [3, 3],
    [7, 3],
    [14, 7],
    [30, 14],
  ] as const)(
    "remediates tomorrow and resumes a failed %s-day review after %s days",
    (currentIntervalDays, expectedResumeInterval) => {
      const completion = calculateReviewCompletion({
        allQuestionIds,
        assessments: { "1": "incorrect", "2": "correct", "3": "correct" },
        currentState: {
          currentIntervalDays,
          pendingIncorrectIds: [],
          resumeIntervalDays: null,
          status: "scheduled-full",
        },
        now,
        scope: "full",
      });

      expect(completion.recommendation.intervalDays).toBe(1);
      expect(completion.state.resumeIntervalDays).toBe(expectedResumeInterval);
    },
  );

  it("keeps only unresolved questions in repeated remediation", () => {
    const completion = calculateReviewCompletion({
      allQuestionIds,
      assessments: { "1": "correct", "3": "incorrect" },
      currentState: {
        currentIntervalDays: 30,
        pendingIncorrectIds: ["1", "3"],
        resumeIntervalDays: 14,
        status: "remediation",
      },
      now,
      scope: "incorrect",
    });

    expect(completion.recommendation.questionIds).toEqual(["3"]);
    expect(completion.state.resumeIntervalDays).toBe(14);
  });
});

describe("LearningDataSchema", () => {
  it("rejects malformed persisted review data", () => {
    expect(
      LearningDataSchema.safeParse({ version: 1, records: [], reviewSets: 42 })
        .success,
    ).toBe(false);
  });

  it("falls back to empty data when persisted JSON is invalid", () => {
    const storage = new MemoryStorage("not-json");

    expect(loadLearningData(storage)).toEqual({
      version: 1,
      records: [],
      reviewSets: [],
    });
  });

  it("persists attempts and resolves the exact generated review set", () => {
    const storage = new MemoryStorage();

    const recommendation = completeAndSaveReview(
      {
        allQuestionIds,
        assessments: { "1": "correct", "2": "incorrect", "3": "correct" },
        contentKind: "quiz",
        now,
        quizPath: "/vault/security.md",
        scope: "full",
      },
      storage,
      () => "review-123",
    );

    expect(recommendation.id).toBe("review-123");
    expect(getReviewSet("review-123", storage)).toEqual(recommendation);
    expect(loadLearningData(storage).records[0]?.attempts).toHaveLength(1);
  });
});

class MemoryStorage implements Storage {
  private value: string | null;

  constructor(value: string | null = null) {
    this.value = value;
  }

  get length() {
    return this.value === null ? 0 : 1;
  }

  clear() {
    this.value = null;
  }

  getItem() {
    return this.value;
  }

  key() {
    return this.value === null ? null : "learning_progress_v1";
  }

  removeItem() {
    this.value = null;
  }

  setItem(_key: string, value: string) {
    this.value = value;
  }
}
