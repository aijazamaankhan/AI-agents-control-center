import { z } from "zod";
import { COMPANY_SIZES, COUNTRY_CODES, INDUSTRIES, isValidTimezone } from "./constants";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Enter your company name").max(100, "Company name is too long"),
  industry: z.enum(INDUSTRIES, { error: "Choose an industry" }),
  companySize: z.enum(COMPANY_SIZES, { error: "Choose a company size" }),
  country: z.string().refine((c) => COUNTRY_CODES.includes(c), { message: "Choose a country" }),
  timezone: z.string().refine(isValidTimezone, { message: "Choose a valid timezone" }),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}
