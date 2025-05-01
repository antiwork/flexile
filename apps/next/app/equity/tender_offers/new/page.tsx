"use client";
import { parseDate } from "@internationalized/date";
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

  const [startDateString, setStartDateString] = useState("");
  const [endDateString, setEndDateString] = useState("");
  const [minimumValuation, setMinimumValuation] = useState(0);
  const [attachment, setAttachment] = useState<File | undefined>(undefined);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();

  const valid = !!(startDateString && endDateString && attachment);

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

      await createTenderOffer.mutateAsync({
        companyId: company.id,
        startsAt: new Date(`${startDateString}T00:00:00Z`),
        endsAt: new Date(`${endDateString}T00:00:00Z`),
        minimumValuation: BigInt(minimumValuation),
        attachmentKey: key,
      });
      router.push(`/equity/tender_offers`);
    },
  });

  const parseDateValue = (dateString: string): DateValue | null => {
    try {
      return dateString ? parseDate(dateString) : null;
    } catch (_e) {
      return null;
    }
  };

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
            <DatePicker
              label="Start date"
              value={parseDateValue(startDateString)}
              onChange={(date) => setStartDateString(date ? date.toString() : "")}
              granularity="day"
            />
            <DatePicker
              label="End date"
              value={parseDateValue(endDateString)}
              onChange={(date) => setEndDateString(date ? date.toString() : "")}
              granularity="day"
            />
            <div className="grid gap-2">
              <Label htmlFor="minimum-valuation">Minimum valuation</Label>
              <NumberInput
                id="minimum-valuation"
                value={minimumValuation}
                onChange={(value) => setMinimumValuation(value || 0)}
                prefix="$"
              />
            </div>
            <div className="*:not-first:mt-2">
              <Label htmlFor="attachment">Attachment</Label>
              <Input
                id="attachment"
                type="file"
                accept="application/zip"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttachment(e.target.files?.[0])}
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
