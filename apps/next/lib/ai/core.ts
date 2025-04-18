import { createHash } from "crypto";
import { APICallError, CoreMessage, CoreTool, embed, generateObject, generateText } from "ai";
import { isWithinTokenLimit as isWithinTokenLimitForCompletion } from "gpt-tokenizer/model/gpt-4o";
import { isWithinTokenLimit as isWithinTokenLimitForEmbeddings } from "gpt-tokenizer/model/text-embedding-3-small";
import { z } from "zod";
import { assertDefined } from "@/components/utils/assert";
import openai from "@/lib/ai/openai";
import { redis } from "@/lib/redis/client";

export const GPT_4O_MODEL = "gpt-4o";
export const GPT_4O_MINI_MODEL = "gpt-4o-mini";

export type AvailableModel = typeof GPT_4O_MINI_MODEL | typeof GPT_4O_MODEL;

const EMBEDDING_MODEL = "text-embedding-3-small";
export const COMPLETION_MODEL = GPT_4O_MODEL;

export const generateEmbedding = async (
  value: string,
  functionId?: string,
  options: { skipCache: boolean } = { skipCache: false },
): Promise<number[]> => {
  const { skipCache } = options;
  const input = value.replaceAll("\n", " ");

  const inputHash = createHash("md5").update(input).digest("hex");
  const cacheKey = `embedding:${inputHash}`;

  if (!skipCache) {
    const cachedEmbedding = await redis.get<number[]>(cacheKey);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }
  }

  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: input,
    experimental_telemetry: {
      isEnabled: true,
      functionId: functionId ?? "generate-embedding",
    },
  });

  // Cache the result (expires in 30 days)
  if (!skipCache) {
    await redis.set(cacheKey, embedding, { ex: 60 * 60 * 24 * 30 });
  }

  return embedding;
};

export const generateCompletion = ({
  model = COMPLETION_MODEL,
  temperature = 0.1,
  shortenPromptBy,
  system,
  prompt,
  messages,
  ...options
}: {
  system?: string;
  model?: AvailableModel;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
  tools?: Record<string, CoreTool>;
  functionId?: string;
  metadata?: Record<string, string | number | boolean>;
  shortenPromptBy?: ShortenPromptOptions;
} & ({ prompt: string; messages?: never } | { messages: CoreMessage[]; prompt?: never })) =>
  retryOnPromptLengthError(shortenPromptBy, { system, prompt, messages }, (prompt) =>
    generateText({
      model: openai(model),
      temperature,
      ...options,
      ...prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: options.functionId ?? "generate-completion",
        metadata: options.metadata,
      },
    }),
  );

export const generateStructuredObject = <T>({
  model = COMPLETION_MODEL,
  temperature = 0.1,
  system,
  prompt,
  messages,
  ...options
}: {
  model?: AvailableModel;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  functionId?: string;
  metadata?: Record<string, string>;
  schema: z.ZodType<T>;
  shortenPromptBy?: ShortenPromptOptions;
} & ({ prompt: string; messages?: never } | { messages: CoreMessage[]; prompt?: never })) =>
  retryOnPromptLengthError(options.shortenPromptBy, { system, prompt, messages }, (prompt) =>
    generateObject<T>({
      model: openai(model),
      temperature,
      ...options,
      ...prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: options.functionId ?? "generate-structured-object",
        metadata: options.metadata,
      },
    }),
  );

export type ShortenPromptOptions = {
  removeSystem?: (string | null | undefined)[];
  truncateMessages?: boolean;
};

const retryOnPromptLengthError = async <Result>(
  shortenPromptBy: ShortenPromptOptions | undefined,
  options: Parameters<typeof shortenPrompt>[0],
  generate: (options: Parameters<typeof shortenPrompt>[0]) => Promise<Result>,
) => {
  const maxRetries = 3;
  for (let retries = 0; ; retries++) {
    try {
      return await generate(options);
    } catch (error) {
      if (!shortenPromptBy || !APICallError.isInstance(error) || retries >= maxRetries) throw error;
      const [_, actual, maximum] = /prompt is too long: (\d+) tokens > (\d+) maximum/.exec(error.message) ?? [];
      if (actual && maximum)
        options = shortenPrompt(options, parseInt(maximum, 10) / parseInt(actual, 10), shortenPromptBy);
      else throw error;
    }
  }
};

const shortenPrompt = (
  { system, prompt, messages }: { system?: string; prompt?: string; messages?: CoreMessage[] },
  ratio: number,
  shortenPromptBy: ShortenPromptOptions,
) => {
  const maxIterations = 10;
  const originalLength = characterLength({ system, prompt, messages });
  const targetLength = Math.floor(originalLength * ratio * 0.9); // Reduce by an extra 10% to be safe
  const shortenSystemBy = [...(shortenPromptBy?.removeSystem ?? [])];

  const result = { system, prompt, messages };
  for (let i = 0; i < maxIterations; i++) {
    if (result.messages && shortenPromptBy?.truncateMessages) {
      const longestMessageIndex = result.messages.reduce(
        (maxIndex, message, index, arr) =>
          typeof message.content === "string" && message.content.length > assertDefined(arr[maxIndex]).content.length
            ? index
            : maxIndex,
        0,
      );
      result.messages = result.messages.map((message, index) =>
        index === longestMessageIndex && typeof message.content === "string"
          ? ({ ...message, content: message.content.slice(0, Math.floor(message.content.length / 2)) } as CoreMessage)
          : message,
      );
    } else if (result.prompt && shortenPromptBy?.truncateMessages) {
      result.prompt = result.prompt.slice(0, result.prompt.length / 2);
    }
    if (characterLength(result) <= targetLength) break;
    if (shortenSystemBy.length > 0) {
      result.system = result.system?.replace(shortenSystemBy.shift() ?? "", "");
    }
    if (characterLength(result) <= targetLength) break;
  }

  return result;
};

const characterLength = ({
  system,
  prompt,
  messages,
}: {
  system?: string;
  prompt?: string;
  messages?: CoreMessage[];
}) => {
  return (
    (system?.length ?? 0) +
    (prompt?.length ?? 0) +
    (messages?.reduce((total, message) => total + message.content.length, 0) ?? 0)
  );
};

export const isWithinTokenLimit = (text: string, isEmbedding = false): boolean => {
  const maxTokens = isEmbedding ? 8191 : 128000;
  // Check if text is within the token limit
  // returns false if the limit is exceeded, otherwise returns the actual number of tokens (truthy value)
  const isWithinTokenLimit = isEmbedding
    ? isWithinTokenLimitForEmbeddings(text, maxTokens)
    : isWithinTokenLimitForCompletion(text, maxTokens);

  return isWithinTokenLimit !== false;
};

export const cleanUpTextForAI = (text: string | null) => {
  if (!text) return "";
  const withoutBase64 = text.replace(/data:image\/[^;]+;base64,[^\s"']+/g, "[IMAGE]");
  const withSingleLineBreaks = withoutBase64.replace(/\n{2,}/g, "\n");
  return withSingleLineBreaks.replace(/\s+/g, " ").trim();
};
