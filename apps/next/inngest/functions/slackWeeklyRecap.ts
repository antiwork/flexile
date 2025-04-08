import { openai } from "@ai-sdk/openai";
import { utc } from "@date-fns/utc";
import { WebClient } from "@slack/web-api";
import { generateObject } from "ai";
import { startOfWeek, subWeeks } from "date-fns";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import env from "@/env";
import { inngest } from "@/inngest/client";
import slackWeeklyRecapPrompt from "@/lib/ai/prompts/slackWeeklyRecap";
import { getUpdateList } from "@/trpc/routes/teamUpdates";
import { assertDefined } from "@/utils/assert";
import { formatServerDate } from "@/utils/time";

const slackClient = new WebClient(env.SLACK_TOKEN, {
  headers: {
    "Accept-Encoding": "identity",
  },
});

export default inngest.createFunction(
  { id: "slack-weekly-recap" },
  { cron: "TZ=America/New_York 0 17 * * 1" }, // Will run at 5pm ET
  async ({ step }) => {
    const updates = await step.run("fetch-updates", async () => {
      const company = assertDefined(
        await db.query.companies.findFirst({
          where: eq(companies.isGumroad, true),
        }),
      );

      const periodStartsOn = formatServerDate(startOfWeek(subWeeks(new Date(), 1), { in: utc }));
      return await getUpdateList({
        companyId: company.id,
        period: [periodStartsOn],
      });
    });

    const aiResponse = await step.run("ai-response", async () => {
      const { object } = await generateObject({
        // NOTE: 'gpt-4.5-preview' is over 450x more expensive than 'gpt-4o-mini'
        model: env.VERCEL_ENV === "production" ? openai("gpt-4.5-preview") : openai("gpt-4o-mini"),
        schema: z.object({
          title: z.string(),
          projects: z.array(
            z.object({
              project_name: z.string(),
              tasks: z.array(
                z.object({
                  label: z.string(),
                  subtasks: z
                    .array(
                      z.object({
                        label: z.string(),
                      }),
                    )
                    .optional(),
                }),
              ),
            }),
          ),
        }),
        system: slackWeeklyRecapPrompt,
        prompt: JSON.stringify(updates, (_key, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      });
      return object;
    });

    await step.run(
      "slack-join-channel",
      async () =>
        await slackClient.conversations.join({
          channel: env.SLACK_CHANNEL_ID,
        }),
    );

    await step.run("slack-send-message", async () => {
      const response = await slackClient.chat.postMessage({
        channel: env.SLACK_CHANNEL_ID,
        blocks: [
          block.richText([element.richTextSection([element.bold(aiResponse.title)])]),
          ...aiResponse.projects
            .filter((project) => project.tasks.length > 0) // Filter out projects with empty task lists
            .map((project) =>
              block.richText([
                element.richTextSection([element.italic(project.project_name), element.newLine()]),
                ...project.tasks.flatMap((task) => {
                  const elementArray = [element.list([element.text(task.label)])];

                  if (task.subtasks && task.subtasks.length > 0) {
                    elementArray.push(
                      element.list(
                        task.subtasks.map((subtask) => element.text(subtask.label)),
                        {
                          indent: 1,
                        },
                      ),
                    );
                  }

                  return elementArray;
                }),
              ]),
            ),
        ],
      });

      return response;
    });
  },
);

const block = {
  richText: (elements: unknown[]) => ({
    type: "rich_text",
    elements,
  }),
};

const element = {
  newLine: (times = 1) => ({
    type: "text",
    text: "\n".repeat(times),
  }),
  italic: (text: string) => ({
    type: "text",
    text,
    style: { italic: true },
  }),
  bold: (text: string) => ({
    type: "text",
    text,
    style: { bold: true },
  }),
  text: (text: string) => ({
    type: "text",
    text,
  }),
  richTextSection: (elements: unknown[]) => ({
    type: "rich_text_section",
    elements,
  }),
  list: (
    elements: unknown[],
    {
      style = "bullet",
      indent = 0,
      border = 0,
    }: { style?: "bullet" | "number"; indent?: number; border?: number } = {},
  ) => ({
    type: "rich_text_list",
    style,
    indent,
    border,
    elements: elements.map((el) => element.richTextSection([el])),
  }),
};
