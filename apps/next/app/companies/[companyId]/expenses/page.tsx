"use client";

import { CheckCircleIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import { Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { stripeMerchantCategoryCodes } from "@/app/companies/[companyId]/expenses";
import MainLayout from "@/components/layouts/Main";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { Button } from "@/components/ui/button";
import env from "@/env/client";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc, useCanAccess } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

const perPage = 50;
const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

type ExpenseCardCharge = RouterOutput["expenseCards"]["charges"]["list"]["items"][number];
export default function ExpensesPage() {
  const user = useCurrentUser();

  return user.activeRole === "administrator" ? <CompanyExpenses /> : <ContractorExpenses />;
}

const columnHelper = createColumnHelper<ExpenseCardCharge>();
const companyColumns = [
  columnHelper.simple("processorTransactionData.merchant_data.name", "Vendor"),
  columnHelper.accessor("contractor", {
    header: "Cardholder",
    cell: (info) => (
      <>
        <strong>{info.getValue().user.name}</strong>
        <div className="text-xs">{info.getValue().role}</div>
      </>
    ),
  }),
  columnHelper.simple("createdAt", "Date", formatDate),
  columnHelper.simple(
    "processorTransactionData.merchant_data.category_code",
    "Merchant Category",
    (v) => (v && stripeMerchantCategoryCodes[v]) || "Uncategorized",
  ),
  columnHelper.display({
    id: "status",
    header: "Status",
    cell: () => <Status variant="success">Approved</Status>,
  }),
  columnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
];

function CompanyExpenses() {
  const [page] = usePage();
  const company = useCurrentCompany();
  const [data] = trpc.expenseCards.charges.list.useSuspenseQuery({ companyId: company.id, page, perPage });
  const table = useTable({ columns: companyColumns, data: data.items });

  return (
    <MainLayout title="Expenses">
      {data.items.length ? (
        <>
          <Table table={table} />
          <PaginationSection total={data.total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>
          <span>No expenses yet.</span>
          <span>To grant expense cards, go to Roles → Edit to turn on for specific roles.</span>
        </Placeholder>
      )}
    </MainLayout>
  );
}

function CardDisplay() {
  const company = useCurrentCompany();
  const [{ card }] = trpc.expenseCards.getActive.useSuspenseQuery({ companyId: company.id });

  const user = useCurrentUser();
  const stripe = useStripe();
  const elements = useElements();
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cvcRef = useRef<HTMLDivElement>(null);

  const { mutateAsync: createEphemeralKey } = trpc.expenseCards.createStripeEphemeralKey.useMutation();

  useEffect(() => {
    const initStripe = async () => {
      if (!card || !stripe || !elements || !cardNumberRef.current || !cvcRef.current) return;

      const { nonce } = await stripe.createEphemeralKeyNonce({ issuingCard: card.processorReference });
      if (!nonce) return;

      const { secret } = await createEphemeralKey({
        companyId: company.id,
        nonce,
        processorReference: card.processorReference,
      });
      if (!secret) return;

      const config = {
        issuingCard: card.processorReference,
        nonce,
        ephemeralKeySecret: secret,
        style: { base: { fontWeight: "bold" } },
      };
      elements.create("issuingCardNumberDisplay", config).mount(cardNumberRef.current);
      elements.create("issuingCardCvcDisplay", config).mount(cvcRef.current);
    };

    void initStripe();
  }, [stripe, elements, card, company.id, cardNumberRef, cvcRef]);

  if (!card) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <h4 className="text-gray-500">Your Card</h4>
        <div className="flex items-center gap-1">
          <strong>{card.cardBrand}</strong>
          <span>•</span>
          <div ref={cardNumberRef} className="flex-1">
            **** **** **** {card.cardLast4}
          </div>
        </div>
        <div>
          Exp {card.cardExpMonth}/{card.cardExpYear}
        </div>
        <div className="flex items-center gap-1">
          <span>CVC</span>
          <div ref={cvcRef} className="flex-1">
            ***
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-gray-500">Billing Address</h4>
        {user.address.street_address}
        <br />
        {user.address.city}
        <br />
        {user.address.zip_code}
        {user.address.state ? `, ${user.address.state}` : ""}, {user.address.country}
      </div>
    </div>
  );
}

const contractorColumns = [
  columnHelper.simple("processorTransactionData.merchant_data.name", "Vendor"),
  columnHelper.simple("createdAt", "Date", formatDate),
  columnHelper.display({
    id: "status",
    header: "Status",
    cell: () => <Status variant="success">Approved</Status>,
  }),
  columnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
];

function ContractorExpenses() {
  const [page] = usePage();
  const user = useCurrentUser();
  if (!user.roles.worker) notFound();
  const company = useCurrentCompany();
  const [cardTermsModalOpen, setCardTermsModalOpen] = useState(false);

  const [expenseCardCharges] = trpc.expenseCards.charges.list.useSuspenseQuery({
    companyId: company.id,
    contractorId: user.roles.worker.id,
    page,
    perPage,
  });

  const [{ card }, { refetch }] = trpc.expenseCards.getActive.useSuspenseQuery({ companyId: company.id });
  const canAccess = useCanAccess();

  const createExpenseCard = trpc.expenseCards.create.useMutation({
    onSuccess: async () => {
      await refetch();
      setCardTermsModalOpen(false);
    },
  });

  const table = useTable({ columns: contractorColumns, data: expenseCardCharges.items });

  return (
    <MainLayout
      title="Expenses"
      headerActions={
        !card && canAccess("expenseCards.create") ? (
          <Button onClick={() => setCardTermsModalOpen(true)}>
            <CreditCardIcon className="h-4 w-4" />
            Apply for card
          </Button>
        ) : null
      }
    >
      <Elements stripe={stripePromise}>
        <CardDisplay />
      </Elements>

      {expenseCardCharges.items.length ? (
        <>
          <Table table={table} />
          <PaginationSection total={expenseCardCharges.total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>No expenses to display.</Placeholder>
      )}

      <Modal open={cardTermsModalOpen} onClose={() => setCardTermsModalOpen(false)} title="Accept Card Terms">
        <p>
          By clicking Apply, you accept{" "}
          <Link
            href="https://stripe.com/legal/issuing/celtic-authorized-user-terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Celtic Bank Authorized User Terms
          </Link>{" "}
          and{" "}
          <Link href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer">
            E-SIGN policy
          </Link>
          .
        </p>
        <MutationButton mutation={createExpenseCard} param={{ companyId: company.id }} loadingText="Applying...">
          Apply
        </MutationButton>
      </Modal>
    </MainLayout>
  );
}
