import { createOpenAI } from "@ai-sdk/openai";
import env from "@/env";

export default createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  compatibility: "strict",
});
