type SAFEInvestor = {
  name: string;
};

type Investor = SAFEInvestor & {
  id: string;
  userId: string;
  notes: string | null;
  outstandingShares: bigint;
  fullyDilutedShares: bigint;
};
type InvestorEntity = SAFEInvestor & {
  id: string;
  notes: string | null;
  outstandingShares: bigint;
  fullyDilutedShares: bigint;
};
type InvestorForAdmin = (Investor | InvestorEntity) & { email: string };

export type CapTableInvestor = Investor | InvestorEntity | SAFEInvestor;

export type CapTableInvestorForAdmin = InvestorForAdmin | SAFEInvestor;

export const isInvestor = (investor: CapTableInvestor): investor is Investor | InvestorEntity => "id" in investor;
export const isInvestorForAdmin = (investor: CapTableInvestorForAdmin): investor is InvestorForAdmin =>
  "email" in investor;

export const fetchInvestorUserId = (investor: CapTableInvestor) => ("userId" in investor ? investor.userId : null);
export const fetchInvestorId = (investor: CapTableInvestor) => ("id" in investor ? investor.id : null);
export const fetchInvestorEmail = (investor: CapTableInvestorForAdmin) =>
  isInvestorForAdmin(investor) ? investor.email : null;
