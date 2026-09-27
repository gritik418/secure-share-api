import { z } from "zod";

const AddFileMemberSchema = z.object({
  email: z.email("Please enter a valid email address."),
});

export type AddFileMemberDto = z.infer<typeof AddFileMemberSchema>;

export default AddFileMemberSchema;
