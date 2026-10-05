import { z } from "zod";

export const decisionSchema = z.object({
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional().default(""),
});

export const decideFormSchema = decisionSchema.extend({
  id: z.string().trim().min(1).max(64),
  decision: z.enum(["APPROVED", "REJECTED"]),
});
