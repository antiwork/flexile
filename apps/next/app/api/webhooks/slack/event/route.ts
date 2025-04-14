import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { verifySlackRequest } from "@/lib/slack/client";
import { handleSlackMessage } from "@/lib/slack/agent/handleMessages";

interface SlackEvent {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    text: string;
    user: string;
    channel: string;
    ts: string;
    thread_ts?: string;
    bot_id?: string;
  };
}

export const POST = async (request: Request) => {
  const body = await request.text();
  if (!(await verifySlackRequest(body, request.headers))) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
  }

  const data: SlackEvent = JSON.parse(body);

  if (data.type === "url_verification" && data.challenge) {
    return NextResponse.json({ challenge: data.challenge });
  }

  if (data.type === "event_callback" && data.event?.type === "message" && !data.event.bot_id) {
    try {
      const company = await db.query.companies.findFirst({
        where: eq(companies.isGumroad, true),
      });
      
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }

      await handleSlackMessage({
        text: data.event.text,
        userId: data.event.user,
        channelId: data.event.channel,
        companyId: company.id,
        ts: data.event.ts,
        threadTs: data.event.thread_ts || undefined,
      });

      return new Response(null, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
};
