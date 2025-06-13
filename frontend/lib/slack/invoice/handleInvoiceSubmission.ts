import { postSlackMessage } from "../client";

interface InvoiceSubmissionData {
  userId: string;
  channelId: string;
  invoiceDate: string | undefined;
  description: string;
  hoursOrAmount: string;
  notes?: string | undefined;
}

export const handleInvoiceSubmission = async (data: InvoiceSubmissionData) => {
  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  if (!slackBotToken) {
    return;
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/trpc/slack.submitInvoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slackUserId: data.userId,
          invoiceDate: data.invoiceDate || new Date().toISOString().split("T")[0],
          description: data.description,
          hoursOrAmount: data.hoursOrAmount,
          notes: data.notes,
        }),
      },
    );

    if (response.ok) {
      await postSlackMessage(
        slackBotToken,
        data.channelId,
        `✅ Invoice submitted successfully! Your invoice for "${data.description}" has been created and is pending approval.`,
        data.userId,
      );
    } else {
      let errorData: { error?: { message?: string } };
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: { message: "Unknown error" } };
      }
      await postSlackMessage(
        slackBotToken,
        data.channelId,
        `❌ Failed to submit invoice: ${errorData.error?.message || "Unknown error occurred"}. Please try again or contact support.`,
        data.userId,
      );
    }
  } catch {
    await postSlackMessage(
      slackBotToken,
      data.channelId,
      `❌ An error occurred while submitting your invoice. Please try again or contact support.`,
      data.userId,
    );
  }
};
