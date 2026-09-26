import type { Response } from "express";
import { ZodError } from "zod";

const raiseZodError = (error: ZodError, res: Response): Response => {
  const formattedErrors = error.issues.reduce(
    (acc, issue) => {
      const field = issue.path.join(".");
      if (!Object.keys(acc).includes(field)) acc[field] = issue.message;
      return acc;
    },
    {} as Record<string, string>,
  );

  return res.status(400).json({
    success: false,
    message: "Validation failed.",
    errors: formattedErrors,
  });
};

export default raiseZodError;
