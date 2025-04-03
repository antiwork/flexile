import { expect, type Page } from "@playwright/test";
import type { NextFixture } from "next/experimental/testmode/playwright";
import { z } from "zod";
import type { users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

type Submitter = Pick<typeof users.$inferSelect, "email" | "id">;
let lastSubmissionId = 1;
export const mockDocuseal = (
  next: NextFixture,
  {
    submitters,
    validateValues,
  }: {
    submitters?: () => MaybePromise<Record<string, Submitter>>;
    validateValues?: (role: string, values: Record<string, string>) => MaybePromise<void>;
  },
) => {
  next.onFetch(async (request) => {
    console.log(request.url);
    if (!submitters) return;
    if (request.url === "https://api.docuseal.com/submissions/init") {
      expect(await request.json()).toEqual({
        template_id: 1,
        send_email: false,
        submitters: expect.arrayContaining(
          Object.entries(await submitters()).map(([role, submitter]) => ({
            email: submitter.email,
            role,
            external_id: submitter.id.toString(),
          })),
        ),
      });
      return Response.json({ id: lastSubmissionId++ });
    } else if (request.url.startsWith("https://api.docuseal.com/submissions/")) {
      return Response.json({
        submitters: Object.entries(await submitters()).map(([role, submitter]) => ({
          id: Number(submitter.id),
          external_id: submitter.id.toString(),
          role,
          status: "awaiting",
        })),
      });
    } else if (request.url.startsWith("https://api.docuseal.com/submitters/")) {
      const role = assertDefined(
        Object.entries(await submitters()).find(
          ([_, submitter]) => submitter.id === BigInt(request.url.split("/").at(-1) ?? ""),
        )?.[0],
      );
      const json = z.object({ values: z.record(z.string(), z.string()) }).parse(await request.json());
      await validateValues?.(role, json.values);
      return new Response();
    }
  });

  const mockForm = async (page: Page) => {
    await page.route("https://docuseal.com/embed/forms", (route) =>
      route.fulfill({
        body: JSON.stringify({
          template: {},
          submitter: { id: 1, email: "email", uuid: "1" },
          submission: {
            template_schema: [],
            template_submitters: [],
            template_fields: [{ submitter_uuid: "1", type: "signature" }],
          },
        }),
      }),
    );
    await page.route("https://docuseal.com/embed/s/*", (route) =>
      route.fulfill({
        body: JSON.stringify({
          submission_id: lastSubmissionId++,
        }),
      }),
    );
  };

  return { mockForm };
};
