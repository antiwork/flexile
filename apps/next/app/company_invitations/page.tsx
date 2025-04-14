"use client";
import { BriefcaseIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";

type InvitedCompany = {
  email: string;
  company: string | null;
};

const columnHelper = createColumnHelper<InvitedCompany>();
const columns = [
  columnHelper.simple("email", "Invited CEO Email"),
  columnHelper.simple("company", "Company Name", (v) => v || "—"),
];

export default function CompanyInvitationsPage() {
  const [invitedCompanies] = trpc.companies.list.useSuspenseQuery({ invited: true });
  const table = useTable({ columns, data: invitedCompanies });

  return (
    <MainLayout
      title="Who are you billing?"
      headerActions={
        invitedCompanies.length > 0 ? (
          <Button variant="outline" asChild>
            <Link href="/company_invitations/new">Invite another</Link>
          </Button>
        ) : null
      }
    >
      {invitedCompanies.length > 0 ? (
        <section>
          <DataTable table={table} />
        </section>
      ) : (
        <Placeholder>
          <p className="text-xl font-bold text-black">Welcome to Flexile</p>
          <p>To get started, invite a company to work with.</p>
          <Button variant="outline" asChild>
            <Link href="/company_invitations/new">
              <BriefcaseIcon className="h-4 w-4" />
              Invite company
            </Link>
          </Button>
        </Placeholder>
      )}
    </MainLayout>
  );
}
