import { z } from "zod";
import { DocumentType } from "@/db/enums";

export const signatorySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  title: z.string(),
  signedAt: z.coerce.date().nullable(),
});

export const attachmentSchema = z.object({
  key: z.string(),
  filename: z.string(),
});

export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.coerce.date(),
  type: z.nativeEnum(DocumentType),
  year: z.number().optional(),
  deletedAt: z.string().nullable().optional(),
  textContent: z.string().nullable().optional(),
  attachment: attachmentSchema.nullable().optional(),
  signatories: z.array(signatorySchema),
});

export type Document = z.infer<typeof documentSchema>;
export type Signatory = z.infer<typeof signatorySchema>;
