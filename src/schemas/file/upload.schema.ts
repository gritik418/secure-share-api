import { z } from "zod";
import { FileVisibility } from "../../generated/prisma/enums.js";

const FileUploadSchema = z.object({
  visibility: z.enum(FileVisibility).optional().default("PRIVATE"),
});

export default FileUploadSchema;

export type FileUploadDto = z.infer<typeof FileUploadSchema>;
