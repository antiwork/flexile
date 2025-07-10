import { z } from "zod";

// Next inlines env variables in the client bundle, so we need to list them out here
const env = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID: process.env.NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID,
};

export default z
  .object({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID: z.string(),
  })
  .parse(env);
