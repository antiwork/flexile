"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import DatePicker from "@/components/DatePicker";
import FormSection from "@/components/FormSection";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";
import type { DateValue } from "react-aria-components";
import { Input } from "@/components/ui/input";

export default function NewBuyback() {
  const company = useCurrentCompany();
  const router = useRouter();

  const [startDate, setStartDate] = useState<DateValue | null>(null);
  const [endDate, setEndDate] = useState<DateValue | null>(null);
  const [minimumValuation, setMinimumValuation] = useState(0);
  const [attachment, setAttachment] = useState<File | undefined>(undefined);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();

  const valid = !!(startDate && endDate && attachment);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!valid) return;

      const base64Checksum = await md5Checksum(attachment);
      const { directUploadUrl, key } = await createUploadUrl.mutateAsync({
        isPublic: false,
        filename: attachment.name,
        byteSize: attachment.size,
        checksum: base64Checksum,
        contentType: attachment.type,
      });

      await fetch(directUploadUrl, {
        method: "PUT",
        body: attachment,
        headers: {
          "Content-Type": attachment.type,
          "Content-MD5": base64Checksum,
        },
      });

      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await createTenderOffer.mutateAsync({
        companyId: company.id,
        startsAt: startDate.toDate(localTimeZone),
        endsAt: endDate.toDate(localTimeZone),
        minimumValuation: BigInt(minimumValuation),
        attachmentKey: key,
      });
      router.push(`/equity/tender_offers`);
    },
  });

  return (
    <MainLayout
      title="Start new buyback"
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/equity/tender_offers">Cancel</Link>
        </Button>
      }
    >
      <FormSection title="Details">
        <CardContent>
          <div className="grid gap-4">
            <DatePicker label="Start date" value={startDate} onChange={setStartDate} granularity="day" />
            <DatePicker label="End date" value={endDate} onChange={setEndDate} granularity="day" />
            <div className="grid gap-2">
              <Label htmlFor="starting-valuation">Starting valuation</Label>
              <NumberInput
                id="starting-valuation"
                value={minimumValuation}
                onChange={(value) => setMinimumValuation(value || 0)}
                prefix="$"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attachment">Document package</Label>
              <Input
                id="attachment"
                type="file"
                accept="application/zip"
                onChange={(e) => setAttachment(e.target.files?.[0])}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <MutationButton mutation={createMutation} disabled={!valid} loadingText="Creating...">
            Create buyback
          </MutationButton>
        </CardFooter>
      </FormSection>
    </MainLayout>
  );
}
