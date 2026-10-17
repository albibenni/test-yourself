import { z } from "zod";

export const AssessmentSchema = z.enum(["correct", "partial", "incorrect"]);
export type Assessment = z.infer<typeof AssessmentSchema>;

export const ReviewScopeSchema = z.enum(["full", "incorrect"]);
export type ReviewScope = z.infer<typeof ReviewScopeSchema>;

export const ReviewIntervalSchema = z.number().int().positive();
export type ReviewInterval = z.infer<typeof ReviewIntervalSchema>;

export const QuizLearningStateSchema = z.object({
  currentIntervalDays: ReviewIntervalSchema.nullable(),
  pendingIncorrectIds: z.array(z.string()),
  resumeIntervalDays: ReviewIntervalSchema.nullable(),
  status: z.enum(["scheduled-full", "remediation"]),
});
export type QuizLearningState = z.infer<typeof QuizLearningStateSchema>;

export const ReviewRecommendationSchema = z.object({
  id: z.string().min(1),
  quizPath: z.string().min(1),
  contentKind: z.enum(["quiz", "question"]),
  scope: ReviewScopeSchema,
  questionIds: z.array(z.string()),
  dueDate: z.string().date(),
  intervalDays: ReviewIntervalSchema,
  createdAt: z.string().datetime(),
});
export type ReviewRecommendation = z.infer<typeof ReviewRecommendationSchema>;

export const ReviewAttemptSchema = z.object({
  id: z.string().min(1),
  assessedAt: z.string().datetime(),
  scope: ReviewScopeSchema,
  assessments: z.record(z.string(), AssessmentSchema),
});

export const LearningRecordSchema = z.object({
  quizPath: z.string().min(1),
  contentKind: z.enum(["quiz", "question"]),
  state: QuizLearningStateSchema,
  attempts: z.array(ReviewAttemptSchema),
});

export const LearningDataSchema = z.object({
  version: z.literal(1),
  records: z.array(LearningRecordSchema),
  reviewSets: z.array(ReviewRecommendationSchema),
});
export type LearningData = z.infer<typeof LearningDataSchema>;

interface CompletionInput {
  allQuestionIds: string[];
  assessments: Record<string, Assessment>;
  currentState: QuizLearningState | undefined;
  now: Date;
  scope: ReviewScope;
}

interface CompletionResult {
  state: QuizLearningState;
  recommendation: Omit<
    ReviewRecommendation,
    "id" | "quizPath" | "contentKind" | "createdAt"
  >;
}

const nextSuccessfulInterval = (
  current: ReviewInterval | null | undefined,
): ReviewInterval => {
  if (!current || current < 3) return 3;
  if (current < 7) return 7;
  if (current < 14) return 14;
  if (current < 30) return 30;
  return current;
};

const recoveryInterval = (
  current: ReviewInterval | null | undefined,
): ReviewInterval => {
  if (current && current > 30) return Math.max(14, Math.round(current / 2));
  if (current === 30) return 14;
  if (current && current >= 14) return 7;
  return 3;
};

const dateAfterDays = (now: Date, days: number): string => {
  const due = new Date(now);
  due.setDate(due.getDate() + days);
  return [
    due.getFullYear(),
    String(due.getMonth() + 1).padStart(2, "0"),
    String(due.getDate()).padStart(2, "0"),
  ].join("-");
};

export function calculateReviewCompletion({
  allQuestionIds,
  assessments,
  currentState,
  now,
  scope,
}: CompletionInput): CompletionResult {
  const incorrectIds = Object.entries(assessments)
    .filter(([, assessment]) => assessment !== "correct")
    .map(([questionId]) => questionId);

  if (incorrectIds.length > 0) {
    const resumeIntervalDays =
      scope === "incorrect"
        ? (currentState?.resumeIntervalDays ?? 3)
        : recoveryInterval(currentState?.currentIntervalDays);
    return {
      state: {
        currentIntervalDays: currentState?.currentIntervalDays ?? null,
        pendingIncorrectIds: incorrectIds,
        resumeIntervalDays,
        status: "remediation",
      },
      recommendation: {
        dueDate: dateAfterDays(now, 1),
        intervalDays: 1,
        questionIds: incorrectIds,
        scope: "incorrect",
      },
    };
  }

  const intervalDays =
    scope === "incorrect"
      ? (currentState?.resumeIntervalDays ?? 3)
      : nextSuccessfulInterval(currentState?.currentIntervalDays);

  return {
    state: {
      currentIntervalDays: intervalDays,
      pendingIncorrectIds: [],
      resumeIntervalDays: null,
      status: "scheduled-full",
    },
    recommendation: {
      dueDate: dateAfterDays(now, intervalDays),
      intervalDays,
      questionIds: allQuestionIds,
      scope: "full",
    },
  };
}

const LEARNING_STORAGE_KEY = "learning_progress_v1";
const EMPTY_LEARNING_DATA: LearningData = {
  version: 1,
  records: [],
  reviewSets: [],
};

export function loadLearningData(storage: Storage = window.localStorage) {
  const stored = storage.getItem(LEARNING_STORAGE_KEY);
  if (!stored) return EMPTY_LEARNING_DATA;
  try {
    const parsed = LearningDataSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : EMPTY_LEARNING_DATA;
  } catch {
    return EMPTY_LEARNING_DATA;
  }
}

const saveLearningData = (data: LearningData, storage: Storage) => {
  storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(data));
};

interface SaveCompletionInput {
  allQuestionIds: string[];
  assessments: Record<string, Assessment>;
  contentKind: "quiz" | "question";
  now?: Date;
  quizPath: string;
  scope: ReviewScope;
}

const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function completeAndSaveReview(
  input: SaveCompletionInput,
  storage: Storage = window.localStorage,
  idFactory: () => string = createId,
): ReviewRecommendation {
  const now = input.now ?? new Date();
  const data = loadLearningData(storage);
  const recordIndex = data.records.findIndex(
    (record) => record.quizPath === input.quizPath,
  );
  const existing = data.records[recordIndex];
  const completion = calculateReviewCompletion({
    allQuestionIds: input.allQuestionIds,
    assessments: input.assessments,
    currentState: existing?.state,
    now,
    scope: input.scope,
  });
  const id = idFactory();
  const assessedAt = now.toISOString();
  const recommendation = ReviewRecommendationSchema.parse({
    ...completion.recommendation,
    id,
    quizPath: input.quizPath,
    contentKind: input.contentKind,
    createdAt: assessedAt,
  });
  const nextRecord = LearningRecordSchema.parse({
    quizPath: input.quizPath,
    contentKind: input.contentKind,
    state: completion.state,
    attempts: [
      ...(existing?.attempts ?? []),
      {
        id: `${id}:attempt`,
        assessedAt,
        scope: input.scope,
        assessments: input.assessments,
      },
    ].slice(-100),
  });
  const records = [...data.records];
  if (recordIndex === -1) records.push(nextRecord);
  else records[recordIndex] = nextRecord;
  saveLearningData(
    LearningDataSchema.parse({
      version: 1,
      records,
      reviewSets: [...data.reviewSets, recommendation].slice(-500),
    }),
    storage,
  );
  return recommendation;
}

export function getReviewSet(
  id: string,
  storage: Storage = window.localStorage,
) {
  return loadLearningData(storage).reviewSets.find(
    (reviewSet) => reviewSet.id === id,
  );
}

const daysBetween = (now: Date, dueDate: string): number => {
  const [year, month, day] = dueDate.split("-").map(Number);
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(year, month - 1, day);
  return Math.max(1, Math.round((end - start) / 86_400_000));
};

export function updateReviewSchedule(
  id: string,
  dueDate: string,
  storage: Storage = window.localStorage,
): ReviewRecommendation | undefined {
  const data = loadLearningData(storage);
  const reviewSetIndex = data.reviewSets.findIndex(
    (reviewSet) => reviewSet.id === id,
  );
  if (reviewSetIndex === -1) return undefined;

  const intervalDays = daysBetween(
    new Date(data.reviewSets[reviewSetIndex].createdAt),
    dueDate,
  );
  const updatedReviewSet = ReviewRecommendationSchema.parse({
    ...data.reviewSets[reviewSetIndex],
    dueDate,
    intervalDays,
  });
  const reviewSets = [...data.reviewSets];
  reviewSets[reviewSetIndex] = updatedReviewSet;
  const records = data.records.map((record) => {
    if (
      record.quizPath !== updatedReviewSet.quizPath ||
      updatedReviewSet.scope !== "full"
    )
      return record;
    return LearningRecordSchema.parse({
      ...record,
      state: { ...record.state, currentIntervalDays: intervalDays },
    });
  });

  saveLearningData(
    LearningDataSchema.parse({ ...data, records, reviewSets }),
    storage,
  );
  return updatedReviewSet;
}
