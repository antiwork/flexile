"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import Button from "@/components/Button";
import { CardRow } from "@/components/Card";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";

export default function NewTenderOffer() {
  const company = useCurrentCompany();
  const router = useRouter();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minimumValuation, setMinimumValuation] = useState(0);
  const [attachment, setAttachment] = useState<File | undefined>(undefined);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();

  const valid = startDate && endDate && minimumValuation && attachment;

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
        startsAt: new Date(startDate),
        endsAt: new Date(endDate),
        minimumValuation: BigInt(minimumValuation),
        attachmentKey: key,
      });
      router.push(`/equity/tender_offers`);
    },
  });

  return (
    <MainLayout
      title="Start new tender offer"
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/equity/tender_offers">Cancel</Link>
        </Button>
      }
    >
      <FormSection title="Details">
        <CardRow className="grid gap-4">
          <Input value={startDate} onChange={setStartDate} type="date" label="Start date" />
          <Input value={endDate} onChange={setEndDate} type="date" label="End date" />
          <NumberInput
            value={minimumValuation}
            onChange={(value) => setMinimumValuation(value || 0)}
            label="Minimum valuation"
            prefix="$"
          />
          <div className="grid gap-2">
            <label htmlFor="attachment">Attachment</label>
            <input
              id="attachment"
              type="file"
              accept="application/zip"
              onChange={(e) => setAttachment(e.target.files?.[0])}
            />
          </div>
        </CardRow>
        <CardRow>
          <MutationButton mutation={createMutation} disabled={!valid} loadingText="Creating...">
            Create tender offer
          </MutationButton>
        </CardRow>
      </FormSection>
    </MainLayout>
  );
}
