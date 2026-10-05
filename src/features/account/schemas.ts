import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Name is too long"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(128, "Use at most 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a different password",
  });
