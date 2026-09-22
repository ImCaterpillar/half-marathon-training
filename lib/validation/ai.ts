import { z } from "zod";

export const applySuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
  change_reason: z.string().trim().max(500).optional(),
});

export const aiGenerateSchema = z.object({
  save: z.coerce.boolean().default(true),
});
