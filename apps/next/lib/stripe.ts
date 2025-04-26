import { Stripe } from "stripe";
import env from "@/env";

// The NPM package `stripe` should match the API version we use.
export const STRIPE_API_VERSION = "2024-04-10";

// @ts-expect-error stripe-version-2024-04-10
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
