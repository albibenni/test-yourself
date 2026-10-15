import { z } from "zod";

export const StringSchema = z.string();
export const BooleanSchema = z.boolean();
export const NullableStringSchema = z.string().nullable();

export const ThemeSchema = z.enum(["system", "light", "dark"]);
export type ThemeType = z.infer<typeof ThemeSchema>;
export const TextScaleSchema = z.enum(["small", "default", "large", "larger"]);
export type TextScale = z.infer<typeof TextScaleSchema>;
export const ContrastPreferenceSchema = z.enum(["system", "more"]);
export type ContrastPreference = z.infer<typeof ContrastPreferenceSchema>;
export const ReducedMotionPreferenceSchema = z.enum(["system", "reduce"]);
export type ReducedMotionPreference = z.infer<
  typeof ReducedMotionPreferenceSchema
>;
export const TextColorSchema = z.enum([
  "slate",
  "zinc",
  "neutral",
  "stone",
  "accent",
]);
export type TextColor = z.infer<typeof TextColorSchema>;
export const AccentColorSchema = z.enum([
  "blue",
  "purple",
  "green",
  "deep-green",
  "rose",
  "red-brick",
  "orange",
]);
export type AccentColor = z.infer<typeof AccentColorSchema>;

export const ThemePreferencesSchema = z.object({
  theme: ThemeSchema.catch("system"),
  accent: AccentColorSchema.catch("blue"),
  textColor: TextColorSchema.catch("slate"),
  textScale: TextScaleSchema.catch("default"),
  contrast: ContrastPreferenceSchema.catch("system"),
  reducedMotion: ReducedMotionPreferenceSchema.catch("system"),
});

export const TodoistDefaultsSchema = z.object({
  defaultDate: z.string().min(1).catch("tomorrow"),
  defaultPriority: z.number().int().min(1).max(4).catch(4),
  defaultProject: z.string().catch(""),
});

export const StoredSettingsSchema = TodoistDefaultsSchema.extend({
  vaultName: z.string().catch(""),
});

export const LibraryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  relative_path: z.string(),
});
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

export const CreationSearchPageSchema = z.object({
  items: z.array(LibraryEntrySchema),
  has_more: z.boolean(),
});

export const CreationStatusSchema = z.object({
  agy_available: z.boolean(),
  codex_available: z.boolean(),
  skills: z.array(z.string()),
});

export const FolderItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  is_dir: z.boolean(),
  md_count: z.number().int().nonnegative(),
});

export const DirectoryListingSchema = z.object({
  current_path: z.string(),
  parent_path: z.string().nullable(),
  items: z.array(FolderItemSchema),
});
export type DirectoryListing = z.infer<typeof DirectoryListingSchema>;

// Quiz and Worksheet Schemas
export const QuizOptionSchema = z.object({
  letter: z.string(),
  text: z.string(),
});
export type QuizOption = z.infer<typeof QuizOptionSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.array(QuizOptionSchema),
  correct_answer: z.string(),
  explanation: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z
  .object({
    title: z.string(),
    path: z.string(),
    topic: z.string(),
    questions: z.array(QuizQuestionSchema),
    last_modified: z.number(),
  })
  .superRefine((quiz, context) => {
    const seenIds = new Set<string>();
    quiz.questions.forEach((question, index) => {
      if (seenIds.has(question.id)) {
        context.addIssue({
          code: "custom",
          message: "Question IDs must be unique",
          path: ["questions", index, "id"],
        });
      }
      seenIds.add(question.id);
    });
  });
export type Quiz = z.infer<typeof QuizSchema>;

export const QuizMetadataSchema = z.object({
  title: z.string(),
  path: z.string(),
  topic: z.string(),
  last_modified: z.number(),
  is_worksheet: z.boolean().optional(),
  is_question: z.boolean().optional(),
});
export type QuizMetadata = z.infer<typeof QuizMetadataSchema>;
export const QuizMetadataArraySchema = z.array(QuizMetadataSchema);

export const WorksheetSchema = z.object({
  title: z.string(),
  path: z.string(),
  topic: z.string(),
  content: z.string(),
  last_modified: z.number(),
});
export type Worksheet = z.infer<typeof WorksheetSchema>;

export const QuestionEntrySchema = z.object({
  id: z.number().int().positive(),
  question: z.string(),
  answer: z.string(),
});
export type QuestionEntry = z.infer<typeof QuestionEntrySchema>;

export const QuestionDocumentSchema = z.object({
  title: z.string(),
  path: z.string(),
  topic: z.string(),
  questions: z.array(QuestionEntrySchema).min(2),
  last_modified: z.number(),
});
export type QuestionDocument = z.infer<typeof QuestionDocumentSchema>;

// Task Provider Schemas
export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();
export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    project_id: z.string().optional(),
    due: z
      .object({
        date: z.string(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export type Task = z.infer<typeof TaskSchema>;

export const ProjectsResponseSchema = z.union([
  z.object({ results: z.array(ProjectSchema) }).transform((val) => val.results),
  z.array(ProjectSchema),
]);

export const TasksResponseSchema = z.union([
  z.object({ results: z.array(TaskSchema) }).transform((val) => val.results),
  z.array(TaskSchema),
]);

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    results: z.array(itemSchema),
    next_cursor: z.string().nullable(),
  });

export const GetTasksArgsSchema = z
  .object({
    filter: z.string().optional(),
    projectId: z.string().optional(),
    sectionId: z.string().optional(),
    label: z.string().optional(),
    lang: z.string().optional(),
  })
  .optional();
