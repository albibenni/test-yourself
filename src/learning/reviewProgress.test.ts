import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  calculateReviewCompletion,
  completeAndSaveReview,
  getReviewSet,
  LearningDataSchema,
  loadLearningData,
  syncLearningProgress,
  updateReviewSchedule,
} from "./reviewProgress";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

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

  it("updates the saved review date and full-review interval after scheduling", () => {
    const storage = new MemoryStorage();
    completeAndSaveReview(
      {
        allQuestionIds,
        assessments: { "1": "correct", "2": "correct", "3": "correct" },
        contentKind: "quiz",
        now,
        quizPath: "/vault/security.md",
        scope: "full",
      },
      storage,
      () => "review-123",
    );

    const updated = updateReviewSchedule("review-123", "2026-12-14", storage);

    expect(updated).toMatchObject({
      dueDate: "2026-12-14",
      intervalDays: 60,
    });
    expect(
      loadLearningData(storage).records[0]?.state.currentIntervalDays,
    ).toBe(60);
    expect(getReviewSet("review-123", storage)).toEqual(updated);
  });

  it("keeps the resumed full-review interval when rescheduling remediation", () => {
    const storage = new MemoryStorage();
    completeAndSaveReview(
      {
        allQuestionIds,
        assessments: { "1": "incorrect", "2": "correct", "3": "correct" },
        contentKind: "quiz",
        now,
        quizPath: "/vault/security.md",
        scope: "full",
      },
      storage,
      () => "review-123",
    );

    updateReviewSchedule("review-123", "2026-10-22", storage);

    expect(loadLearningData(storage).records[0]?.state).toMatchObject({
      currentIntervalDays: null,
      resumeIntervalDays: 3,
    });
    expect(getReviewSet("review-123", storage)).toMatchObject({
      dueDate: "2026-10-22",
      intervalDays: 7,
    });
  });

  it("replaces device-local progress with the validated vault result", async () => {
    const storage = new MemoryStorage();
    const synced = {
      version: 1 as const,
      records: [],
      reviewSets: [
        {
          id: "review-from-another-device",
          quizPath: "/this-device/security.md",
          contentKind: "quiz" as const,
          scope: "full" as const,
          questionIds: ["1"],
          dueDate: "2026-10-21",
          intervalDays: 3,
          createdAt: "2026-10-18T10:00:00.000Z",
        },
      ],
    };
    vi.mocked(invoke).mockResolvedValueOnce(synced);

    await expect(syncLearningProgress(storage)).resolves.toEqual(synced);
    expect(loadLearningData(storage)).toEqual(synced);
    expect(invoke).toHaveBeenCalledWith("sync_learning_progress", {
      localData: { version: 1, records: [], reviewSets: [] },
    });
  });

  it("keeps an untouched backup before migrating local progress", async () => {
    const storage = new MemoryStorage();
    completeAndSaveReview(
      {
        allQuestionIds,
        assessments: { "1": "correct", "2": "correct", "3": "correct" },
        contentKind: "quiz",
        now,
        quizPath: "/old-clone/security.md",
        scope: "full",
      },
      storage,
      () => "legacy-review",
    );
    const original = storage.getItem("learning_progress_v1");
    vi.mocked(invoke).mockResolvedValueOnce({
      version: 1,
      records: [],
      reviewSets: [],
    });

    await syncLearningProgress(storage);

    expect(storage.getItem("learning_progress_v1_backup")).toBe(original);
  });
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  constructor(value: string | null = null) {
    if (value !== null) this.values.set("learning_progress_v1", value);
  }

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
