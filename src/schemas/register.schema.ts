import { z } from "zod";

const RegisterSchema = z
  .object({
    name: z
      .string()
      .min(3, "Name must be at least 3 characters.")
      .max(30, "Name must not exceed 30 characters."),

    email: z.email("Invalid email address."),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(30, "Password must not exceed 30 characters."),

    passwordConfirmation: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(30, "Password must not exceed 30 characters."),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirmation) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["passwordConfirmation"],
      });
    }
  });

export default RegisterSchema;

export type RegisterDto = z.infer<typeof RegisterSchema>;
