import { desc, eq, isNull } from "drizzle-orm";
import { companyAdministrators, userComplianceInfos, users } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

type User = typeof users.$inferSelect;
const emailColumns = { email: true, unconfirmedEmail: true } as const;
export const userDisplayEmail = (user: Pick<User, keyof typeof emailColumns>) =>
  assertDefined(user.email || user.unconfirmedEmail);
userDisplayEmail.columns = emailColumns;

const displayNameColumns = {
  ...emailColumns,
  preferredName: true,
  legalName: true,
} as const;
export const userDisplayName = (user: Pick<User, keyof typeof displayNameColumns>) =>
  user.preferredName || user.legalName || userDisplayEmail(user);
userDisplayName.columns = displayNameColumns;

const simpleUserColumns = { externalId: true, ...displayNameColumns } as const;
export const simpleUser = (user: Pick<User, keyof typeof simpleUserColumns>) => ({
  id: user.externalId,
  name: userDisplayName(user),
  email: userDisplayEmail(user),
});
simpleUser.columns = simpleUserColumns;

export const latestUserComplianceInfo = {
  orderBy: [desc(userComplianceInfos.taxInformationConfirmedAt)],
  limit: 1,
  where: isNull(userComplianceInfos.deletedAt),
};

export const withRoles = (companyId: bigint) => {
  const where = { where: eq(companyAdministrators.companyId, companyId) };
  return {
    companyAdministrators: where,
    companyContractors: where,
    companyInvestors: where,
    companyLawyers: where,
  };
};
