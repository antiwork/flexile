"use client";
import { BriefcaseIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/trpc/client";

export default function CompanyInvitationsPage() {
  const [invitedCompanies] = trpc.companies.list.useSuspenseQuery({ invited: true });

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invited CEO Email</TableHead>
                <TableHead>Company Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitedCompanies.map((company, index) => (
                <TableRow key={index}>
                  <TableCell>{company.email}</TableCell>
                  <TableCell>{company.company || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
