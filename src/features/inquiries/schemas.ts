import { z } from "zod";
import {
  BUDGET_OPTIONS,
  SERVICE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  TIMELINE_OPTIONS,
} from "@/config/site";

const text = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, `Use at most ${max} characters`));

const optionalChoice = <T extends readonly [string, ...string[]]>(options: T) =>
  z
    .string()
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => v === "" || (options as readonly string[]).includes(v), {
      message: "Choose an option",
    });

const contact = {
  name: z.string().trim().min(2, "Enter your name").max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
  company: text(120),
  phone: text(40).refine((v) => v === "" || /^[+\d\s().-]{6,40}$/.test(v), {
    message: "Enter a valid phone number",
  }),
  /** Honeypot: real users never see or fill this field. */
  website: z.string().optional(),
};

export const serviceInquirySchema = z.object({
  ...contact,
  service: z.enum(SERVICE_OPTIONS, { error: "Choose a service" }),
  budget: optionalChoice(BUDGET_OPTIONS),
  timeline: optionalChoice(TIMELINE_OPTIONS),
  message: z
    .string()
    .trim()
    .min(20, "Tell us a little more (at least 20 characters)")
    .max(5000, "Use at most 5,000 characters"),
});

export const demoRequestSchema = z.object({
  ...contact,
  company: z.string().trim().min(2, "Enter your company").max(120, "Company name is too long"),
  teamSize: optionalChoice(TEAM_SIZE_OPTIONS),
  message: text(2000),
});

export type ServiceInquiryInput = z.infer<typeof serviceInquirySchema>;
export type DemoRequestInput = z.infer<typeof demoRequestSchema>;
