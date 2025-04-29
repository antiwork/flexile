import { companies, companyContractors, companyRoles } from "@/db/schema";

type Company = typeof companies.$inferSelect;
type CompanyContractor = typeof companyContractors.$inferSelect;
type CompanyRole = typeof companyRoles.$inferSelect;
export const policies = {
  "expenseCards.create": ({ companyContractor, company }) =>
    companyContractor &&
    !companyContractor.endedAt &&
    company.expenseCardsEnabled &&
    companyContractor.role.expenseCardEnabled,
} satisfies Record<
  string,
  (ctx: {
    user: unknown;
    company: Pick<Company, "expenseCardsEnabled">;
    companyAdministrator: unknown;
    companyContractor:
      | (Pick<CompanyContractor, "endedAt"> & { role: Pick<CompanyRole, "expenseCardEnabled"> })
      | undefined;
    companyInvestor: unknown;
    companyLawyer: unknown;
  }) => unknown
>;
