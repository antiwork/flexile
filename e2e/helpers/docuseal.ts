import { expect, type Page } from "@playwright/test";
import type { NextFixture } from "next/experimental/testmode/playwright";
import { z } from "zod";
import type { users } from "@/db/schema";

type Submitter = Pick<typeof users.$inferSelect, "email" | "id">;
export const mockDocuseal = (
  next: NextFixture,
  {
    companyRepresentative,
    signer,
    validateCompanyRepresentativeValues,
    validateSignerValues,
  }: {
    companyRepresentative: () => MaybePromise<Submitter>;
    signer: () => MaybePromise<Submitter>;
    validateCompanyRepresentativeValues?: (values: Record<string, string>) => MaybePromise<void>;
    validateSignerValues?: (values: Record<string, string>) => MaybePromise<void>;
  },
) => {
  next.onFetch(async (request) => {
    if (request.url === "https://api.docuseal.com/submissions/init") {
      const companyRepresentativeSubmitter = await companyRepresentative();
      const signerSubmitter = await signer();
      expect(await request.json()).toEqual({
        template_id: 1,
        send_email: false,
        submitters: [
          {
            email: companyRepresentativeSubmitter.email,
            role: "Company Representative",
            external_id: companyRepresentativeSubmitter.id.toString(),
          },
          { email: signerSubmitter.email, role: "Signer", external_id: signerSubmitter.id.toString() },
        ],
      });
      return Response.json({ id: 1 });
    } else if (request.url === "https://api.docuseal.com/submissions/1") {
      return Response.json({
        submitters: [
          { id: 1, external_id: "1", role: "Company Representative", status: "awaiting" },
          { id: 2, external_id: "2", role: "Signer", status: "awaiting" },
        ],
      });
    } else if (request.url.startsWith("https://api.docuseal.com/submitters/")) {
      const json = z.object({ values: z.record(z.string(), z.string()) }).parse(await request.json());
      await (request.url.endsWith("1") ? validateCompanyRepresentativeValues : validateSignerValues)?.(json.values);
      return new Response();
    }
    return "continue" as const;
  });

  const mockForm = (page: Page) =>
    page.route("https://docuseal.com/embed/forms", (route) =>
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

  return { mockForm };
};
