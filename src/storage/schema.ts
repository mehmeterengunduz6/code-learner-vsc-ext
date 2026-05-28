import { z } from "zod";

export const FuzzyContextSchema = z.object({
  before: z.string().max(500),
  block: z.string().max(1000),
  after: z.string().max(500),
});

export const AnchorsSchema = z.object({
  symbol: z.string().min(1),
  contentHash: z.string().min(1),
  fuzzyContext: FuzzyContextSchema,
});

export const ReviewQuestionSchema = z.object({
  q: z.string().min(1).max(200),
  a: z.string().min(1).max(400),
});

export const ContentSchema = z.object({
  reasoning: z.string().min(1).max(4000),
  explanation: z.string().min(1).max(4000),
  reviewQuestions: z.array(ReviewQuestionSchema).max(5).default([]),
  conceptTags: z.array(z.string().min(1).max(40)).max(8).default([]),
});

export const NoteStateSchema = z.enum(["active", "orphaned"]);

export const NoteSchema = z.object({
  id: z.string().uuid(),
  file: z.string().min(1),
  anchors: AnchorsSchema,
  content: ContentSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  agent: z.string().min(1),
  state: NoteStateSchema,
});

export type Note = z.infer<typeof NoteSchema>;
