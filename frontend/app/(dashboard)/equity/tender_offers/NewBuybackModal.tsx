import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate } from "@internationalized/date";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { CloudUpload, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import RichText from "@/components/RichText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogStackContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";

const formSchema = z
  .object({
    name: z.string().min(1, "Buyback name is required"),
    startDate: z.instanceof(CalendarDate, { message: "This field is required." }),
    endDate: z.instanceof(CalendarDate, { message: "This field is required." }),
    minimumValuation: z.number(),
    attachment: z.instanceof(File, { message: "This field is required." }),
    totalAmount: z.number().min(0),
  })
  .superRefine((data, ctx) => {
    if (data.startDate.compare(data.endDate) >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["endDate"],
      });
    }
    if (!data.minimumValuation || data.minimumValuation <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starting valuation is required for tender offers",
        path: ["minimumValuation"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type NewBuybackModalProps = {
  onClose: () => void;
};

type BaseSectionProps<T = unknown> = {
  mutation?: UseMutationResult<unknown, unknown, void> | undefined;
  onNext?: (data: T) => void;
  onBack?: () => void;
};

type BuybackFormSectionProps = BaseSectionProps<FormValues> & {
  onNext: (data: FormValues) => void;
  mutation?: UseMutationResult<unknown, unknown, FormValues> | undefined;
};

type CreateLetterOfTransmittalSectionProps = BaseSectionProps<string> & {
  onNext: (data: string) => void;
  onBack: () => void;
};

type SectionNextButtonProps = React.ComponentProps<typeof Button> & {
  mutation?: UseMutationResult<unknown, unknown, void> | undefined;
  children?: React.ReactNode;
};

const NewBuybackModal = ({ onClose }: NewBuybackModalProps) => {
  const company = useCurrentCompany();

  const [buybackData, setBuybackData] = useState<FormValues | null>(null);

  const [currentStep, setCurrentStep] = useState(0);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();
  const [letterData, setLetterData] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!buybackData) {
        return;
      }

      const { name, startDate, endDate, minimumValuation, attachment, totalAmount } = buybackData;

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
        name,
        startsAt: startDate.toDate(localTimeZone),
        endsAt: endDate.toDate(localTimeZone),
        minimumValuation: BigInt(minimumValuation),
        attachmentKey: key,
        totalAmountInCents: BigInt(new Decimal(totalAmount).mul(100).toString()),
        letterOfTransmittal: letterData,
      });
    },
    onSuccess: () => {
      setCurrentStep(0);
      setBuybackData(null);
      onClose();
    },
  });

  const handleBuybackFormNext = (data: FormValues) => {
    setBuybackData(data);
    goToNextStep();
  };

  const handleLetterOfTransmittalNext = (data: string) => {
    setLetterData(data);
    goToNextStep();
  };

  const goToNextStep = () => {
    if (!sections[currentStep + 1]) {
      createMutation.mutate();
      return;
    }
    setCurrentStep(Math.min(sections.length - 1, currentStep + 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const sections = [
    <BuybackFormSection key="buyback-form" onNext={handleBuybackFormNext} />,
    <CreateLetterOfTransmittalSection
      key="letter-of-transmittal"
      onNext={handleLetterOfTransmittalNext}
      onBack={goToPreviousStep}
      mutation={createMutation}
    />,
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogStackContent step={currentStep}>{sections}</DialogStackContent>
    </Dialog>
  );
};

const BuybackFormSection = ({ onNext, mutation }: BuybackFormSectionProps) => {
  const [dragActive, setDragActive] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const handleSubmit = form.handleSubmit((values) => onNext(values));

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip")) {
        form.setValue("attachment", file);
        form.clearErrors("attachment");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      form.setValue("attachment", e.target.files[0]);
      form.clearErrors("attachment");
    }
  };

  const watchedFile = form.watch("attachment");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Start a new buyback</DialogTitle>
        <DialogDescription>
          Set the timeline, valuation, and upload your buyback terms to begin collecting investor bids.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={(e) => void handleSubmit(e)} className="-m-1 max-h-[65vh] space-y-4 overflow-y-auto p-1">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buyback name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
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
                    <DatePicker {...field} label="End date" granularity="day" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="minimumValuation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starting valuation</FormLabel>
                <FormControl>
                  <NumberInput {...field} prefix="$" placeholder="0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target buyback value</FormLabel>
                <FormControl>
                  <NumberInput {...field} prefix="$" placeholder="0" />
                </FormControl>
                <FormDescription className="text-xs">
                  Total amount of money you intend to spend on this buyback.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attachment"
            render={() => (
              <FormItem>
                <FormLabel>Buyback documents</FormLabel>
                <FormControl>
                  {watchedFile instanceof File ? (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                            ZIP
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{watchedFile.name}</div>
                            <div className="text-xs text-gray-500">{(watchedFile.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            form.resetField("attachment");
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
                        dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <CloudUpload className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                      <div className="text-sm font-medium">
                        <span>Drag and drop</span> or{" "}
                        <label className="cursor-pointer text-blue-600 hover:text-blue-500">
                          <span>click to browse</span>
                          <input
                            name="attachment"
                            type="file"
                            accept=".zip,application/zip"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>{" "}
                        your ZIP file here
                      </div>
                    </div>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <DialogFooter>
        <SectionNextButton onClick={() => void handleSubmit()} className="w-full sm:w-auto" mutation={mutation} />
      </DialogFooter>
    </>
  );
};

const CreateLetterOfTransmittalSection = ({ onNext, onBack, mutation }: CreateLetterOfTransmittalSectionProps) => {
  const form = useForm({
    resolver: zodResolver(z.object({ data: z.string().min(1, "This field is required.") })),
    defaultValues: { data: "" },
  });

  const handleSubmit = form.handleSubmit(({ data }) => {
    onNext(data);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Letter of transmittal</DialogTitle>
        <DialogDescription>
          Add the Letter of Transmittal to explain the buyback terms. Investors will see it during confirmation.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-auto px-1 py-1">
          <Form {...form}>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col">
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormControl>
                      <div>
                        <RichText
                          editable
                          content={field.value || ""}
                          onChange={field.onChange}
                          className="border-input placeholder:text-muted-foreground h-[50vh] max-w-none overflow-y-auto rounded-md border bg-transparent p-3 text-sm"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Rich text formatting will be preserved. You can paste from Word or Google Docs.
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
      </div>

      <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <SectionNextButton onClick={() => void handleSubmit()} className="w-full sm:w-auto" mutation={mutation} />
      </DialogFooter>
    </>
  );
};

const SectionNextButton = ({ mutation, children, ...props }: SectionNextButtonProps) => {
  if (mutation) {
    return (
      <MutationStatusButton mutation={mutation} {...props}>
        {children || "Create buyback"}
      </MutationStatusButton>
    );
  }

  return <Button {...props}>{children || "Continue"}</Button>;
};

export default NewBuybackModal;
