import { companyContractors } from "@/db/schema";

type CompanyContractor = typeof companyContractors.$inferSelect;
export const policies = {
  "dummy.policy": (_ctx) => true,
} satisfies Record<
  string,
  (ctx: {
    user: unknown;
    company: { id: string | bigint };
    companyAdministrator: unknown;
    companyContractor: Pick<CompanyContractor, "endedAt"> | undefined;
    companyInvestor: unknown;
    companyLawyer: unknown;
  }) => unknown
>;
