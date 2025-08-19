import { z } from "zod";

// Next inlines env variables in the client bundle, so we need to list them out here
const env = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

export default z
  .object({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
  })
  .parse(env);
