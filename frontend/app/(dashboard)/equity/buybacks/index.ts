import { utc } from "@date-fns/utc";
import { isFuture } from "date-fns";
import { z } from "zod";

// TODO replace this with a better representation, at least in the DB
export const VESTED_SHARES_CLASS = "Vested shares from equity grants";

export const buybackSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  buyback_type: z.enum(["single_stock", "tender_offer"]).nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  minimum_valuation: z.number(),
  implied_valuation: z.number().nullable().optional(),
  accepted_price_cents: z.number().nullable(),
  participation: z.string().nullable(),
  bid_count: z.number().nullable(),
  investor_count: z.number().nullable(),
  equity_buyback_round_count: z.number().nullable(),
  equity_buyback_payment_count: z.number().nullable().optional(),
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
  total_amount_in_cents: z.number().optional().nullable(),
});

export type Buyback = z.infer<typeof buybackSchema>;

export const buybackBidSchema = z.object({
  id: z.string(),
  share_class: z.string(),
  number_of_shares: z.string(),
  accepted_shares: z.string(),
  share_price_cents: z.number(),
  investor: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type BuybackBid = z.infer<typeof buybackBidSchema>;

export const getBuybackStatus = (buyback: Buyback) => {
  if (buyback.equity_buyback_payment_count) return "Settled";
  if (buyback.equity_buyback_round_count) return "Closed";
  if (isFuture(utc(buyback.ends_at)) || buyback.open) return "Open";
  return "Reviewing";
};
