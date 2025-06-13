import { NextRequest, NextResponse } from "next/server";
import { verifySlackRequest, openSlackModal } from "@/lib/slack/client";
import { createInvoiceModal } from "@/lib/slack/invoice/invoiceModal";
import { handleInvoiceSubmission } from "@/lib/slack/invoice/handleInvoiceSubmission";

interface SlackPayload {
  type?: string;
  view?: {
    callback_id?: string;
    state?: {
      values?: Record<string, Record<string, { value?: string; selected_date?: string }>>;
    };
    private_metadata?: string;
  };
  user?: {
    id?: string;
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers = request.headers;

  if (!(await verifySlackRequest(body, headers))) {
    return NextResponse.json({ error: "Invalid Slack signature" }, { status: 403 });
  }

  const isFormData = headers.get("content-type")?.includes("application/x-www-form-urlencoded");

  if (isFormData) {
    const payload = new URLSearchParams(body);
    const command = payload.get("command");
    const triggerId = payload.get("trigger_id");

    if (command === "/submit-invoice" && triggerId) {
      const slackBotToken = process.env.SLACK_BOT_TOKEN;
      if (!slackBotToken) {
        return NextResponse.json(
          {
            response_type: "ephemeral",
            text: "Slack bot token not configured. Please contact support.",
          },
          { status: 500 },
        );
      }

      try {
        await openSlackModal({
          token: slackBotToken,
          triggerId,
          title: "Submit Invoice",
          view: createInvoiceModal(),
        });

        return NextResponse.json({});
      } catch {
        return NextResponse.json(
          {
            response_type: "ephemeral",
            text: "Sorry, there was an error opening the invoice form. Please try again.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      response_type: "ephemeral",
      text: "Use `/submit-invoice` to create a new invoice.",
    });
  }
  const payloadParam = new URLSearchParams(body).get("payload");
  if (!payloadParam) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let payload: SlackPayload;
  try {
    payload = JSON.parse(payloadParam);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.type === "view_submission" && payload.view?.callback_id === "invoice_submission") {
    const values = payload.view.state?.values;
    const userId = payload.user?.id;
    const channelId = payload.view.private_metadata || payload.user?.id;

    if (!values || !userId) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const submissionData = {
      userId,
      channelId: channelId || userId,
      invoiceDate: values.invoice_date?.date_select?.selected_date || new Date().toISOString().split("T")[0],
      description: values.description?.description_input?.value || "",
      hoursOrAmount: values.hours_or_amount?.hours_amount_input?.value || "",
      notes: values.notes?.notes_input?.value,
    };

    try {
      await handleInvoiceSubmission(submissionData);
    } catch (error) {
      return NextResponse.json({ error: 'Failed to process invoice submission' }, { status: 500 });
    }

    return NextResponse.json({});
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
