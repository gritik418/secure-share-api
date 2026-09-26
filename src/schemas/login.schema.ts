import { z } from "zod";

const LoginSchema = z.object({
  email: z.email("Invalid email address."),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(30, "Password must not exceed 30 characters."),
});

export default LoginSchema;

export type LoginDto = z.infer<typeof LoginSchema>;
