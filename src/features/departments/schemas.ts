import { z } from "zod";

export const MAX_DEPARTMENTS = 200;
export const DEPARTMENT_NAME_MAX = 60;

export const RECOMMENDED_DEPARTMENTS = [
  "Marketing",
  "Sales",
  "Customer Support",
  "Finance",
  "HR",
  "Operations",
  "Engineering",
  "Analytics",
] as const;

const name = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter a department name")
      .max(DEPARTMENT_NAME_MAX, `Use at most ${DEPARTMENT_NAME_MAX} characters`),
  );

export const departmentSchema = z.object({
  name,
  description: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(280, "Use at most 280 characters")),
});

// Explicit (not .partial()): an omitted description must stay undefined, never become "".
export const departmentUpdateSchema = z
  .object({
    name: name.optional(),
    description: z.string().trim().max(280, "Use at most 280 characters").optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "Nothing to update",
  });

/** Onboarding step 2: a list of names; blanks dropped, duplicates (case-insensitive) removed. */
export const onboardingDepartmentsSchema = z
  .array(z.string())
  .max(50, "Add at most 50 departments here — you can add more later")
  .transform((names) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
      const n = raw.trim().replace(/\s+/g, " ");
      if (!n || seen.has(departmentNameKey(n))) continue;
      seen.add(departmentNameKey(n));
      out.push(n);
    }
    return out;
  })
  .pipe(z.array(name));

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

export function departmentNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
