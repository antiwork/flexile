import { z } from "zod";

// Next inlines env variables in the client bundle, so we need to list them out here
const env = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
};

export default z
  .object({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
  })
  .parse(env);
