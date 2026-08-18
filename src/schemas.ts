import { z } from "zod";

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

export const QuizSchema = z.object({
  title: z.string(),
  path: z.string(),
  topic: z.string(),
  questions: z.array(QuizQuestionSchema),
  last_modified: z.number(),
});
export type Quiz = z.infer<typeof QuizSchema>;

export const QuizMetadataSchema = z.object({
  title: z.string(),
  path: z.string(),
  topic: z.string(),
  last_modified: z.number(),
  is_worksheet: z.boolean().optional(),
  is_scenario: z.boolean().optional(),
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

export const ScenarioSchema = z.object({
  title: z.string(),
  path: z.string(),
  topic: z.string(),
  content: z.string(),
  last_modified: z.number(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

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

export const GetTasksArgsSchema = z
  .object({
    filter: z.string().optional(),
    projectId: z.string().optional(),
    sectionId: z.string().optional(),
    label: z.string().optional(),
    lang: z.string().optional(),
  })
  .optional();
