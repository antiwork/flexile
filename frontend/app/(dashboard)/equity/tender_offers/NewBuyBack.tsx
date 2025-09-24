"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate } from "@internationalized/date";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CloudUpload, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useDocumentTemplateQuery } from "@/app/(dashboard)/documents";
import DatePicker from "@/components/DatePicker";
import { linkClasses } from "@/components/Link";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Placeholder from "@/components/Placeholder";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { cn, formatFileSize, md5Checksum } from "@/utils";

const formSchema = z.object({
  startDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  endDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  minimumValuation: z.number(),
  attachment: z.instanceof(File, { message: "This field is required." }),
  letterOfTransmittal: z.string().min(1, "This field is required."),
});

type NewBuybackFormProps = {
  handleComplete: () => void;
};

export default function NewBuybackForm({ handleComplete }: NewBuybackFormProps) {
  const company = useCurrentCompany();
  const { data: letterOfTransmittal } = useQuery(useDocumentTemplateQuery("letter_of_transmittal"));
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { letterOfTransmittal: letterOfTransmittal?.text ?? "" },
  });

  const attachmentValue = form.watch("attachment");

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { startDate, endDate, minimumValuation, attachment, letterOfTransmittal } = values;

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
        letterOfTransmittal,
      });
    },

    onSuccess: () => {
      form.reset();
      handleComplete();
    },
  });

  const submit = form.handleSubmit((data) => createMutation.mutate(data));

  return (
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
              {attachmentValue instanceof File ? (
                <div className="border-input flex items-center gap-2 rounded-md border py-2 pl-2">
                  <div className="flex h-full w-10 items-center justify-center rounded-sm bg-blue-50 p-2 text-sm text-blue-600">
                    ZIP
                  </div>
                  <div>
                    <p>{attachmentValue.name}</p>
                    <p className="text-muted-foreground text-sm">{formatFileSize(attachmentValue.size)}</p>
                  </div>
                  <Button
                    variant="link"
                    size="icon"
                    className="ml-auto hover:text-red-600"
                    onClick={() => field.onChange("")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <label
                  className="relative"
                  onDragEnter={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                >
                  <Placeholder
                    icon={CloudUpload}
                    className={cn("border-2", { "border-dashed border-blue-500 bg-blue-50": isDragging })}
                  >
                    <b>
                      Drag and drop or <span className={cn(linkClasses, "text-blue-500")}>click to browse</span> your
                      ZIP file here
                    </b>
                  </Placeholder>
                  <FormControl>
                    <input
                      type="file"
                      accept="application/zip"
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      onChange={(e) => field.onChange(e.target.files?.[0])}
                    />
                  </FormControl>
                </label>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="letterOfTransmittal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Letter of transmittal</FormLabel>
              <FormControl>
                <RichTextEditor {...field} aria-label="Letter of transmittal" />
              </FormControl>
              <FormMessage>
                <span className="text-xs text-gray-500">
                  Rich text formatting will be preserved. You can paste from Word or Google Docs.
                </span>
              </FormMessage>
            </FormItem>
          )}
        />

        <MutationStatusButton
          className="justify-self-end"
          type="submit"
          size="small"
          mutation={createMutation}
          loadingText="Creating..."
        >
          Create buyback
        </MutationStatusButton>
      </form>
    </Form>
  );
}
