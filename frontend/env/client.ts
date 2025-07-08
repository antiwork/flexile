import { z } from "zod";

// Next inlines env variables in the client bundle, so we need to list them out here
const env = {
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID: process.env.NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_SECRET_TOKEN: process.env.NEXT_PUBLIC_API_SECRET_TOKEN,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_PULL_REQUEST_ID: process.env.VERCEL_GIT_PULL_REQUEST_ID,
};

export default z
  .object({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID: z.string(),
    NEXT_PUBLIC_API_URL: z.string().optional(),
    NEXT_PUBLIC_API_SECRET_TOKEN: z.string().optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    VERCEL_GIT_PULL_REQUEST_ID: z.string().optional(),
  })
  .parse(env);
