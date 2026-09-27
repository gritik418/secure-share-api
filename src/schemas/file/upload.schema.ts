import { z } from "zod";
import { FileVisibility } from "../../generated/prisma/enums.js";

const FileUploadSchema = z
  .object({
    visibility: z.enum(FileVisibility).optional().default("PRIVATE"),

    mails: z.array(z.email()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.visibility === "PRIVATE" &&
      (!data.mails || data.mails.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["mails"],
        message: "At least one email is required for private files.",
      });
    }

    if (data.visibility !== "PRIVATE" && data.mails?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["mails"],
        message: "Emails are only allowed for private files.",
      });
    }
  });

export default FileUploadSchema;

export type FileUploadDto = z.infer<typeof FileUploadSchema>;
