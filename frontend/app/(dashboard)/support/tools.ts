export const helperTools = ({ companyId, contractorId }: { companyId: string; contractorId: string | undefined }) => ({
  getInvoices: {
    description: "Fetch a list of recent invoices",
    parameters: {},
    url: `/api/helper/invoices?companyId=${companyId}&contractorId=${contractorId ?? ""}`,
  },
});
