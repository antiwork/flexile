import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { cache } from "react";
import { capTableRouter } from "@/trpc/routes/capTable";
import { companiesRouter } from "@/trpc/routes/companies";
import { equityCalculationsRouter } from "@/trpc/routes/equityCalculations";
import { filesRouter } from "@/trpc/routes/files";
import { financingRoundsRouter } from "@/trpc/routes/financingRounds";
import { investorEntitiesRouter } from "@/trpc/routes/investorEntities";
import { capTableUploadsRouter } from "./routes/capTableUploads";
import { companyAdministratorsRouter } from "./routes/companyAdministrators";
import { companyUpdatesRouter } from "./routes/companyUpdates";
import { consolidatedInvoicesRouter } from "./routes/consolidatedInvoices";
import { contractorsRouter } from "./routes/contractors";
import { convertibleSecuritiesRouter } from "./routes/convertibleSecurities";
import { dividendRoundsRouter } from "./routes/dividendRounds";
import { dividendsRouter } from "./routes/dividends";
import { documentsRouter } from "./routes/documents";
import { equityAllocationsRouter } from "./routes/equityAllocations";
import { equityGrantExercisesRouter } from "./routes/equityGrantExercises";
import { equityGrantsRouter } from "./routes/equityGrants";
import { equitySettingsRouter } from "./routes/equitySettings";
import { expenseCardsRouter } from "./routes/expenseCards";
import { expenseCategoriesRouter } from "./routes/expenseCategories";
import { financialReportsRouter } from "./routes/financialReports";
import { githubRouter } from "./routes/github";
import { investorsRouter } from "./routes/investors";
import { invoicesRouter } from "./routes/invoices";
import { lawyersRouter } from "./routes/lawyers";
import { optionPoolsRouter } from "./routes/optionPools";
import { quickbooksRouter } from "./routes/quickbooks";
import { rolesRouter } from "./routes/roles";
import { shareHoldingsRouter } from "./routes/shareHoldings";
import { tenderOffersRouter } from "./routes/tenderOffers";
import { usersRouter } from "./routes/users";
import { walletsRouter } from "./routes/wallets";
import { workerAbsencesRouter } from "./routes/workerAbsences";
import { createClient } from "./shared";
import { createCallerFactory, createRouter } from "./";

export const appRouter = createRouter({
  users: usersRouter,
  wallets: walletsRouter,
  contractors: contractorsRouter,
  roles: rolesRouter,
  quickbooks: quickbooksRouter,
  github: githubRouter,
  invoices: invoicesRouter,
  consolidatedInvoices: consolidatedInvoicesRouter,
  documents: documentsRouter,
  equityGrants: equityGrantsRouter,
  shareHoldings: shareHoldingsRouter,
  investors: investorsRouter,
  convertibleSecurities: convertibleSecuritiesRouter,
  dividends: dividendsRouter,
  dividendRounds: dividendRoundsRouter,
  equityGrantExercises: equityGrantExercisesRouter,
  tenderOffers: tenderOffersRouter,
  workerAbsences: workerAbsencesRouter,
  financialReports: financialReportsRouter,
  equitySettings: equitySettingsRouter,
  financingRounds: financingRoundsRouter,
  optionPools: optionPoolsRouter,
  companyUpdates: companyUpdatesRouter,
  capTable: capTableRouter,
  capTableUploads: capTableUploadsRouter,
  companies: companiesRouter,
  files: filesRouter,
  expenseCategories: expenseCategoriesRouter,
  expenseCards: expenseCardsRouter,
  investorEntities: investorEntitiesRouter,
  equityAllocations: equityAllocationsRouter,
  equityCalculations: equityCalculationsRouter,
  companyAdministrators: companyAdministratorsRouter,
  lawyers: lawyersRouter,
});
export type AppRouter = typeof appRouter;

export const getQueryClient = cache(createClient);
const caller = createCallerFactory(appRouter)({ userId: null, host: "", ipAddress: "", userAgent: "", headers: {} });
export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(caller, getQueryClient);
