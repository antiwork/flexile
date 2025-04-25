/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { type SlackEvent } from "@slack/web-api";
import { waitUntil } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import {
  handleAssistantThreadMessage,
  handleMessage,
  isAgentThread,
  type SlackIntegration,
} from "@/lib/slack/agent/handleMessages";
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
        case "tokens_revoked": {
          const integration = await db.query.integrations.findFirst({
            where: and(eq(integrations.type, "SlackIntegration"), eq(integrations.accountId, data.team_id)),
            with: {
              company: true,
            },
          });

          if (integration) {
            await db
              .update(integrations)
              .set({
                status: "deleted",
              })
              .where(eq(integrations.id, integration.id));
          }
          return NextResponse.json({ message: "Success!" }, { status: 200 });
        }
        case "message": {
          if (event.subtype || event.bot_id || event.bot_profile) {
            // No messages we need to handle
            return NextResponse.json({ message: "Success!" }, { status: 200 });
          }
          const integration = await db.query.integrations.findFirst({
            where: and(eq(integrations.type, "SlackIntegration"), eq(integrations.accountId, data.team_id)),
            with: {
              company: true,
            },
          });
          if (!integration) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

          if (event.channel_type === "im" || (await isAgentThread(event, integration as SlackIntegration))) {
            waitUntil(handleMessage(event, integration as SlackIntegration));
            return NextResponse.json({ message: "Success!" }, { status: 200 });
          }
          break;
        }

        case "app_mention": {
          const integration = await db.query.integrations.findFirst({
            where: and(eq(integrations.type, "SlackIntegration"), eq(integrations.accountId, data.team_id)),
            with: {
              company: true,
            },
          });
          if (!integration) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
          waitUntil(handleMessage(event, integration as SlackIntegration));
          return NextResponse.json({ message: "Success!" }, { status: 200 });
        }

        case "assistant_thread_started": {
          const integration = await db.query.integrations.findFirst({
            where: and(eq(integrations.type, "SlackIntegration"), eq(integrations.accountId, data.team_id)),
            with: {
              company: true,
            },
          });
          if (!integration) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

          waitUntil(handleAssistantThreadMessage(event, integration as SlackIntegration));
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
