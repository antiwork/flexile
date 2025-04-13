"use client";
import { Mail } from "lucide-react";
import { useParams } from "next/navigation";
import React from "react";
import { Card, CardRow } from "@/components/Card";
import MainLayout from "@/components/layouts/Main";
import RichText from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { countries } from "@/models/constants";
import { PayRateType, trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";

export default function ContractorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile] = trpc.contractorProfiles.get.useSuspenseQuery({ id });

  return (
    <MainLayout
      title="Talent"
      headerActions={
        <Button variant="outline" asChild>
          <a href={`mailto:${profile.email}`}>
            <Mail className="size-4" />
            Message
          </a>
        </Button>
      }
    >
      <Card>
        <CardRow className="grid gap-4">
          <h1 className="text-3xl font-bold">{profile.preferredName}</h1>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-4">
              <div>
                <h2 className="text-xl font-bold">Role</h2>
                <span>{profile.role}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">Rate</h2>
                <span>
                  {formatMoneyFromCents(profile.payRateInSubunits)}
                  {" / "}
                  {profile.payRateType === PayRateType.Hourly ? "hour" : "project"}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold">Availability</h2>
                <span>{profile.availableHoursPerWeek} hours per week</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">Country</h2>
                {countries.get(profile.countryCode ?? "")}
              </div>
              <div>
                <h2 className="text-xl font-bold">Email</h2>
                <span>{profile.email}</span>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold">About</h2>
              <RichText content={profile.description} />
            </div>
          </div>
        </CardRow>
      </Card>
    </MainLayout>
  );
}
