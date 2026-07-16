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
  correct_answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
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
