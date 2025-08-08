import "server-only";
import { z } from "zod";
import clientEnv from "./client";

const env = z
  .object({
    DATABASE_URL: z.string(),
    RESEND_API_KEY: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    S3_PRIVATE_BUCKET: z.string(),
    S3_PUBLIC_BUCKET: z.string(),
    QUICKBOOKS_CLIENT_ID: z.string(),
    QUICKBOOKS_CLIENT_SECRET: z.string(),
    STRIPE_ENDPOINT_SECRET: z.string(),
    STRIPE_SECRET_KEY: z.string(),
    ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY: z.string(),
    ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY: z.string(),
    ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT: z.string(),
    DOMAIN: z.string(),
    DOCUSEAL_TOKEN: z.string(),
    DOCUSEAL_USER_EMAIL: z.string(),
    SLACK_WEBHOOK_URL: z.string(),
    SLACK_WEBHOOK_CHANNEL: z.string(),
    SLACK_TOKEN: z.string(),
    SLACK_CHANNEL_ID: z.string(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    WISE_PROFILE_ID: z.string(),
    WISE_API_KEY: z.string(),
    HELPER_HMAC_SECRET: z.string(),
    API_SECRET_TOKEN: z.string(),
    NEXTAUTH_SECRET: z.string(),
  })
  .parse(process.env);

export default { ...env, ...clientEnv };
