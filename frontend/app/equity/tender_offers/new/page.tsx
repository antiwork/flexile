"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import DatePicker from "@/components/DatePicker";
import MainLayout from "@/app/components/main-layout";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { CalendarDate } from "@internationalized/date";

const formSchema = z.object({
  startDate: z.instanceof(CalendarDate),
  endDate: z.instanceof(CalendarDate),
  minimumValuation: z.number(),
  attachment: z.instanceof(File),
});

export default function NewBuyback() {
  const company = useCurrentCompany();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { startDate, endDate, minimumValuation, attachment } = values;

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

  const submit = form.handleSubmit((data) => createMutation.mutate(data));

  return (
    <MainLayout
      title="Start new buyback"
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/equity/tender_offers">Cancel</Link>
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <DatePicker {...field} label="Start date" granularity="day" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <DatePicker label="End date" {...field} granularity="day" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minimumValuation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starting valuation</FormLabel>
                <FormControl>
                  <NumberInput {...field} prefix="$" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attachment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document package</FormLabel>
                <FormControl>
                  <Input type="file" accept="application/zip" onChange={(e) => field.onChange(e.target.files?.[0])} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <MutationStatusButton
            className="justify-self-end"
            type="submit"
            mutation={createMutation}
            loadingText="Creating..."
          >
            Create buyback
          </MutationStatusButton>
        </form>
      </Form>
    </MainLayout>
  );
}
