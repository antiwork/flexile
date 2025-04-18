import { retry } from "@lifeomic/attempt";
import { CoreMessage, GenerateTextResult, Tool } from "ai";
import { z } from "zod";
import { aiUsageEvents } from "@/db/schema/aiUsageEvents";
import { mailboxes } from "@/db/schema/mailboxes";
import { trackAIUsageEvent } from "@/lib/data/aiUsageEvents";
import {
  AvailableModel,
  COMPLETION_MODEL,
  generateCompletion,
  generateEmbedding,
  generateStructuredObject,
  ShortenPromptOptions,
} from "./core";

export { generateCompletion, generateEmbedding, generateStructuredObject };

type CommonAIQueryOptions = {
  messages: CoreMessage[];
  mailbox: typeof mailboxes.$inferSelect;
  queryType: (typeof aiUsageEvents.$inferSelect)["queryType"];
  model?: AvailableModel;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  functionId?: string;
  shortenPromptBy?: ShortenPromptOptions;
};

export const runAIQuery = async ({
  messages,
  mailbox,
  queryType,
  model = COMPLETION_MODEL,
  system,
  temperature = 0.0,
  maxTokens = 500,
  maxSteps,
  tools,
  functionId,
  shortenPromptBy,
}: CommonAIQueryOptions & { maxSteps?: number; tools?: Record<string, Tool> }): Promise<string> => {
  const response = await runWithRetry(
    () =>
      generateCompletion({
        messages,
        model,
        system,
        temperature,
        maxTokens,
        maxSteps,
        tools,
        functionId,
        shortenPromptBy,
        metadata: {
          mailboxSlug: mailbox.slug,
        },
      }),
    { mailbox, queryType, model },
  );
  return response.text;
};

export const runAIObjectQuery = async <T>({
  messages,
  mailbox,
  queryType,
  schema,
  model = COMPLETION_MODEL,
  system,
  temperature = 0.0,
  maxTokens = 500,
  functionId,
  shortenPromptBy,
}: CommonAIQueryOptions & {
  schema: z.ZodType<T>;
}): Promise<T> => {
  const response = await runWithRetry(
    () =>
      generateStructuredObject({
        messages,
        schema,
        model,
        system,
        temperature,
        maxTokens,
        functionId,
        shortenPromptBy,
      }),
    { mailbox, queryType, model },
  );
  return response.object;
};

const runWithRetry = async <
  T extends Pick<GenerateTextResult<any, any>, "usage"> & {
    experimental_providerMetadata?: { openai?: { cachedTokens: number } };
  },
>(
  operation: () => Promise<T>,
  options: Omit<Parameters<typeof trackAIUsageEvent>[0], "usage">,
): Promise<T> => {
  return await retry(
    async () => {
      const result = await operation();
      const metadata = result.experimental_providerMetadata?.openai as { cachedPromptTokens?: number };
      const usage = {
        ...result.usage,
        cachedTokens: metadata?.cachedPromptTokens ?? 0,
      };
      await trackAIUsageEvent({ ...options, usage });
      return result;
    },
    {
      maxAttempts: 3,
      delay: 1000,
      factor: 2,
      jitter: true,
      maxDelay: 60000,
    },
  );
};
