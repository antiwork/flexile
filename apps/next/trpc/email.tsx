import { Button } from "@react-email/components";
import { chunk } from "lodash-es";
import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import { z } from "zod";
import env from "@/env";
import { renderTiptap } from "@/trpc";

export const resend = new Resend(env.RESEND_API_KEY);
export const BATCH_SIZE = 100; // Resend limit: https://resend.com/docs/api-reference/emails/send-batch-emails
const defaultFrom = `Flexile <noreply@${env.DOMAIN}>`;
export const recipientSchema = z.object({ email: z.string() }).passthrough();

type EmailOptions = Omit<CreateEmailOptions, "from" | "html" | "text"> & { from?: string; react: React.ReactNode };
export const sendEmail = async (email: EmailOptions) => {
  const response = await resend.emails.send({ from: defaultFrom, ...email });
  if (response.error) throw new Error(`Resend error: ${response.error.message}`);
};

export const sendEmails = async (options: Omit<EmailOptions, "to">, recipients: z.infer<typeof recipientSchema>[]) =>
  Promise.all(
    chunk(recipients, BATCH_SIZE).map((batch) =>
      resend.batch
        .send(batch.map((recipient) => ({ from: defaultFrom, ...options, to: recipient.email })))
        .then((response) => {
          if (response.error) throw new Error(`Resend error: ${response.error.message}`);
        }),
    ),
  );

export const RichText = ({ content }: { content: string }) => (
  <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderTiptap(content) }} />
);

export const LinkButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Button href={href} className="block rounded-full bg-black px-4 py-4 text-center whitespace-nowrap text-white">
    {children}
  </Button>
);
