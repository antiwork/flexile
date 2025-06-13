import type { ModalView } from "@slack/web-api";

export const createInvoiceModal = (): Partial<ModalView> => ({
  callback_id: "invoice_submission",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Fill out the details for your invoice submission:",
      },
    },
    {
      type: "divider",
    },
    {
      type: "input",
      block_id: "invoice_date",
      element: {
        type: "datepicker",
        action_id: "date_select",
        initial_date: new Date().toISOString().split("T")[0],
        placeholder: {
          type: "plain_text",
          text: "Select invoice date",
        },
      },
      label: {
        type: "plain_text",
        text: "Invoice date",
      },
    },
    {
      type: "input",
      block_id: "description",
      element: {
        type: "plain_text_input",
        action_id: "description_input",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "Describe the work performed...",
        },
      },
      label: {
        type: "plain_text",
        text: "Work description",
      },
    },
    {
      type: "input",
      block_id: "hours_or_amount",
      element: {
        type: "plain_text_input",
        action_id: "hours_amount_input",
        placeholder: {
          type: "plain_text",
          text: "Enter hours (e.g., 8.5) or fixed amount (e.g., $500)",
        },
      },
      label: {
        type: "plain_text",
        text: "Hours worked or fixed amount",
      },
    },
    {
      type: "input",
      block_id: "notes",
      element: {
        type: "plain_text_input",
        action_id: "notes_input",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "Any additional notes or comments...",
        },
      },
      label: {
        type: "plain_text",
        text: "Notes (optional)",
      },
      optional: true,
    },
  ],
});
