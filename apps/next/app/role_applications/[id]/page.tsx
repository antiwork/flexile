"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardRow } from "@/components/Card";
import MainLayout from "@/components/layouts/Main";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import RichText from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import { PayRateType, trpc } from "@/trpc/client";
import { calculateAnnualCompensation } from "@/trpc/routes/roles/applications/helpers";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { useOnGlobalEvent } from "@/utils/useOnGlobalEvent";

export default function RoleApplicationPage() {
  const router = useRouter();
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();

  const [application] = trpc.roles.applications.get.useSuspenseQuery({
    companyId: company.id,
    id: BigInt(id),
  });
  const [role] = trpc.roles.get.useSuspenseQuery({
    companyId: company.id,
    id: application.role.id,
  });
  const [applications, { refetch }] = trpc.roles.applications.list.useSuspenseQuery({
    companyId: company.id,
    roleId: role.id,
  });
  const index = applications.findIndex((a) => a.id === BigInt(id));
  const prev = applications[index - 1];
  const next = applications[index + 1];

  const annualCompensation = calculateAnnualCompensation({ role, application });

  const reject = trpc.roles.applications.reject.useMutation();
  const rejectMutation = useMutation({
    mutationFn: () => reject.mutateAsync({ companyId: company.id, id: BigInt(id) }),
    onSuccess: async () => {
      const nextId = next?.id || prev?.id;
      await refetch();
      router.replace(nextId ? `/role_applications/${nextId}` : `/roles/${role.id}/applications`);
    },
  });

  useOnGlobalEvent("keydown", (event) => {
    switch (event.key) {
      case "ArrowLeft":
      case "j":
        if (prev) {
          router.push(`/role_applications/${prev.id}`);
        }
        break;
      case "ArrowRight":
      case "k":
        if (next) {
          router.push(`/role_applications/${next.id}`);
        }
        break;
      case "x":
        rejectMutation.mutate();
        break;
    }
  });

  return (
    <MainLayout
      title={
        <div className="flex items-center gap-2">
          {prev ? (
            <Link href={`/role_applications/${prev.id}`} aria-label="Previous application">
              <ArrowLeft className="size-4" />
            </Link>
          ) : (
            <ArrowLeft className="size-4 text-gray-500" />
          )}
          {next ? (
            <Link href={`/role_applications/${next.id}`} aria-label="Next application">
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <ArrowRight className="size-4 text-gray-500" />
          )}
          <h1 className="text-3xl font-bold">
            {index + 1} of {applications.length}
          </h1>
        </div>
      }
      headerActions={
        <>
          <MutationButton idleVariant="outline" mutation={rejectMutation} loadingText="Dismissing...">
            <X size={16} />
            Dismiss
          </MutationButton>
          <Button asChild>
            <Link href={`/people/new?application_id=${id}`}>
              <Check size={16} />
              Invite
            </Link>
          </Button>
        </>
      }
    >
      <Card>
        <CardRow className="grid gap-4">
          <h1 className="text-3xl font-bold">{application.name}</h1>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold">Role</h2>
              <span>{role.name}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">Rate</h2>
              <span>
                {formatMoneyFromCents(role.payRateInSubunits)}
                {role.payRateType === PayRateType.Hourly
                  ? " / hour"
                  : role.payRateType === PayRateType.Salary
                    ? " / year"
                    : null}
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold">About</h2>
            <RichText content={application.description} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Email</h2>
            <Link className={linkClasses} href={`mailto:${application.email}`}>
              {application.email}
            </Link>
          </div>
          <div>
            <h2 className="text-xl font-bold">Application date</h2>
            {formatDate(application.createdAt)}
          </div>
          <div>
            <h2 className="text-xl font-bold">Country</h2>
            {countries.get(application.countryCode) ?? ""}
          </div>
          {role.payRateType === PayRateType.Hourly && (
            <>
              <div>
                <h2 className="text-xl font-bold">Availability</h2>
                {application.hoursPerWeek} hours / week
                <br />
                {application.weeksPerYear} weeks / year
              </div>
              <div>
                <h2 className="text-xl font-bold">Annual compensation</h2>≈{formatMoney(annualCompensation)}
              </div>
            </>
          )}
          {application.equityPercent > 0 && (
            <div>
              <h2 className="text-xl font-bold">Equity split</h2>
              {application.equityPercent}%
            </div>
          )}
        </CardRow>
      </Card>
    </MainLayout>
  );
}
