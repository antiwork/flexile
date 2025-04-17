import { SlackEvent } from "@slack/web-api";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies } from "@/db/schema";
//import { disconnectSlack } from "@/lib/data/mailbox";
//import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { findCompanyForEvent } from "@/lib/slack/agent/findCompanyForEvent";
import { handleAssistantThreadMessage, handleMessage, isAgentThread } from "@/lib/slack/agent/handleMessages";
import { verifySlackRequest } from "@/lib/slack/client";

export const POST = async (request: Request) => {
  const body = await request.text();
  if (!(await verifySlackRequest(body, request.headers))) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
  }

  const data = JSON.parse(body) as SlackEvent;

  if (data.type === "url_verification") {
    return NextResponse.json({ challenge: data.challenge });
  }

  if (data.type === "event_callback" && data.event.type === "tokens_revoked") {
    for (const userId of data.event.tokens.bot) {
      const company = await db.query.companies.findFirst({
        where: eq(companies.slackTeamId, data.team_id) && eq(companies.slackBotUserId, userId),
      });

      if (company) await disconnectSlack(company.id);
    }
    return new Response(null, { status: 200 });
  }

  const event = data.event as SlackEvent | undefined;

  if (!event) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (event.type === "message" && (event.subtype || event.bot_id || event.bot_profile)) {
    // Not messages we need to handle
    return new Response("Success!", { status: 200 });
  }

  const companyInfo = await handleSlackErrors(findCompanyForEvent(event));
  if (!companyInfo?.companies.length) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (
    event.type === "app_mention" ||
    (event.type === "message" &&
      (event.channel_type === "im" || (await handleSlackErrors(isAgentThread(event, mailboxInfo)))))
  ) {
    waitUntil(handleSlackErrors(handleMessage(event, mailboxInfo)));
    return new Response("Success!", { status: 200 });
  }

  if (event.type === "assistant_thread_started") {
    waitUntil(handleSlackErrors(handleAssistantThreadMessage(event, mailboxInfo)));
    return new Response("Success!", { status: 200 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
};

const handleSlackErrors = async <T>(operation: Promise<T>) => {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof Error && "data" in error) {
      captureExceptionAndLog(error, {
        extra: {
          slackResponse: error.data,
        },
      });
    }
    captureExceptionAndLog(error);
  }
};
