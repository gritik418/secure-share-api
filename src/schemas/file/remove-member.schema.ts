import { z } from "zod";

const RemoveFileMemberSchema = z.object({
  email: z.email("Please enter a valid email address."),
});

export type RemoveFileMemberDto = z.infer<typeof RemoveFileMemberSchema>;

export default RemoveFileMemberSchema;
