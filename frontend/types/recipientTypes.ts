import { z } from "zod";

export const RECIPIENT_TYPES = ["admins", "investors", "active_contractors", "alumni_contractors"] as const;

export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export const recipientTypeSchema = z.enum(RECIPIENT_TYPES);

export const recipientTypesSchema = z.array(recipientTypeSchema);

export const minBilledAmountSchema = z.number().nonnegative().optional();
