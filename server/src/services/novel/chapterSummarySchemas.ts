import { z } from "zod";

export const chapterConcreteFactCategorySchema = z.enum([
  "completed",
  "revealed",
  "state_changed",
]);

export const chapterConcreteFactSchema = z.object({
  text: z.string().trim().min(1),
  category: chapterConcreteFactCategorySchema,
});

export const chapterSummaryOutputSchema = z.object({
  summary: z.string().trim().min(1),
  concreteFacts: z.array(chapterConcreteFactSchema).max(12).optional(),
});

export type ChapterConcreteFact = z.infer<typeof chapterConcreteFactSchema>;
export type ChapterSummaryOutput = z.infer<typeof chapterSummaryOutputSchema>;
