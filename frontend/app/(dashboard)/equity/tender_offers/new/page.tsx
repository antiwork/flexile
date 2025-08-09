"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";

const formSchema = z.object({
  startDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  endDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  minimumValuation: z.number(),
  attachment: z.instanceof(File, { message: "This field is required." }),
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
    <>
      <DashboardHeader
        title="Start new buyback"
        headerActions={
          <Button variant="outline" asChild>
            <Link href="/equity/tender_offers">Cancel</Link>
          </Button>
        }
      />

      <div className="mx-4">
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
      </div>
    </>
  );
}
