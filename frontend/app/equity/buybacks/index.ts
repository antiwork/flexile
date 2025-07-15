import { z } from "zod";

// TODO replace this with a better representation, at least in the DB
export const VESTED_SHARES_CLASS = "Vested shares from equity grants";

export const buybackSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["single", "tender"]).optional(),
  starts_at: z.string().transform((date) => new Date(date)),
  ends_at: z.string().transform((date) => new Date(date)),
  minimum_valuation: z.number(),
  implied_valuation: z.number().nullable().optional(),
  accepted_price_cents: z.number().nullable(),
  participation: z.number().nullable(),
  bid_count: z.number().nullable(),
  investor_count: z.number().nullable(),
  equity_buyback_round_count: z.number().nullable(),
  open: z.boolean(),
  attachment: z
    .object({
      key: z.string(),
      filename: z.string(),
    })
    .nullable(),
  letter_of_transmittal: z
    .object({
      key: z.string(),
      filename: z.string(),
    })
    .nullable(),
  starting_price_per_share_cents: z.number().optional().nullable(),
});

export type Buyback = z.infer<typeof buybackSchema>;

export const createBuybackSchema = buybackSchema
  .pick({ type: true, name: true, starts_at: true, ends_at: true, minimum_valuation: true })
  .extend({
    total_amount_in_cents: z.number(),
    starting_price_per_share_cents: z.number(),
    letter_of_transmittal: z.object({
      type: z.enum(["link", "text"]),
      data: z.string(),
    }),
    investors: z.array(z.string()),
    attachment: z.instanceof(File).optional(),
    attachment_key: z.string().optional(),
  });

export const buybackBidSchema = z.object({
  id: z.string(),
  share_class: z.string(),
  number_of_shares: z.number({ coerce: true }).min(0),
  accepted_shares: z.number({ coerce: true }).optional(),
  share_price_cents: z.number().min(0),
  investor: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export const placeBuybackBidSchema = buybackBidSchema.pick({
  share_class: true,
  number_of_shares: true,
  share_price_cents: true,
});

export type BuybackBid = z.infer<typeof buybackBidSchema>;
