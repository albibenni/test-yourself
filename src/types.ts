import { z } from "zod";

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
});
export type QuizMetadata = z.infer<typeof QuizMetadataSchema>;
