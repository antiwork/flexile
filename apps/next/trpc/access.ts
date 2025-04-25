import { companies, companyContractors } from "@/db/schema";

type Company = typeof companies.$inferSelect;
type CompanyContractor = typeof companyContractors.$inferSelect;
export const policies = {} satisfies Record<
  string,
  (ctx: {
    user: unknown;
    company: Pick<Company, "id">;
    companyAdministrator: unknown;
    companyContractor: Pick<CompanyContractor, "endedAt" | "onTrial"> | undefined;
    companyInvestor: unknown;
    companyLawyer: unknown;
  }) => unknown
>;
