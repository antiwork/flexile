import { type SlackEvent } from "@slack/web-api";
import { waitUntil } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { handleAssistantThreadMessage, handleMessage, isAgentThread } from "@/lib/slack/agent/handleMessages";
import { validSlackWebhookRequest } from "@/lib/slack/client";

interface SlackUrlVerification {
  type: "url_verification";
  token: string;
  challenge: string;
}

interface SlackEventCallback {
  type: "event_callback";
  event: SlackEvent;
  team_id: string;
  api_app_id: string;
  event_id: string;
  event_time: number;
  authed_users?: string[];
}

type SlackWebhookPayload = SlackUrlVerification | SlackEventCallback;

interface SlackWebhookRequest extends Request {
  json(): Promise<SlackWebhookPayload>;
}

export const POST = async (request: SlackWebhookRequest) => {
  if (!validSlackWebhookRequest(await request.text(), request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const data = await request.json();

  switch (data.type) {
    case "url_verification":
      return NextResponse.json({ challenge: data.challenge }, { status: 200 });

    case "event_callback": {
      const event = data.event;

      switch (event.type) {
        case "tokens_revoked":
          for (const userId of event.tokens.bot ?? []) {
            const company = await db.query.companies.findFirst({
              where: and(eq(companies.slackTeamId, data.team_id), eq(companies.slackBotUserId, userId)),
            });

            if (company) {
              await db
                .update(companies)
                .set({
                  slackBotUserId: null,
                  slackBotToken: null,
                  slackTeamId: null,
                })
                .where(eq(companies.id, company.id));
            }
          }
          return NextResponse.json({ message: "Success!" }, { status: 200 });

        case "message": {
          if (event.subtype || event.bot_id || event.bot_profile) {
            // No messages we need to handle
            return NextResponse.json({ message: "Success!" }, { status: 200 });
          }
          const companyMessage = await db.query.companies.findFirst({
            where: eq(companies.slackTeamId, data.team_id),
          });
          if (!companyMessage) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

          if (event.channel_type === "im" || (await isAgentThread(event, companyMessage))) {
            waitUntil(handleMessage(event, companyMessage));
            return NextResponse.json({ message: "Success!" }, { status: 200 });
          }
          break;
        }

        case "app_mention": {
          const companyAppMention = await db.query.companies.findFirst({
            where: eq(companies.slackTeamId, data.team_id),
          });
          if (!companyAppMention) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

          waitUntil(handleMessage(event, companyAppMention));
          return NextResponse.json({ message: "Success!" }, { status: 200 });
        }

        case "assistant_thread_started": {
          const companyAssistant = await db.query.companies.findFirst({
            where: eq(companies.slackTeamId, data.team_id),
          });
          if (!companyAssistant) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

          waitUntil(handleAssistantThreadMessage(event, companyAssistant));
          return NextResponse.json({ message: "Success!" }, { status: 200 });
        }

        default:
          return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
};
