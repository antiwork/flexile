import { utc } from "@date-fns/utc";
import { isPast } from "date-fns";
import type { RouterOutput } from "@/trpc";

// TODO replace this with a better representation, at least in the DB
export const VESTED_SHARES_CLASS = "Vested shares from equity grants";

type TenderOffer = RouterOutput["tenderOffers"]["list"][number];
export const getBuybackStatus = (buyback: Pick<TenderOffer, "open" | "endsAt" | "settled">) => {
  if (buyback.settled) return "Settled";
  if (!buyback.open && isPast(utc(buyback.endsAt))) return "Closed";
  if (buyback.open) return "Open";
  return "Reviewing";
};
