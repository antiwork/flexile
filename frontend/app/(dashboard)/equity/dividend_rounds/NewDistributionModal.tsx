import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { BasicRichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogStackContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_dividend_computations_path } from "@/utils/routes";

interface NewDistributionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const schema = z.object({
  return_of_capital: z.boolean(),
  name: z.string().min(1, "Distribution name is required"),
  dividends_issuance_date: z.instanceof(CalendarDate, { message: "This field is required." }),
  amount_in_usd: z.number().min(0.01, "Amount must be greater than 0"),
  release_document: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const NewDistributionModal = ({ open, onOpenChange }: NewDistributionModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [requireReleaseDocument, setRequireReleaseDocument] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      return_of_capital: false,
      name: "",
      dividends_issuance_date: today(getLocalTimeZone()),
      amount_in_usd: 0,
      release_document: "",
    },
  });

  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await request({
        method: "POST",
        accept: "json",
        url: company_dividend_computations_path(company.id),
        jsonData: {
          dividend_computation: {
            ...data,
            dividends_issuance_date: data.dividends_issuance_date.toString(),
          },
        },
      });
    },
    onSuccess: () => {
      utils.dividendComputations.list.invalidate({ companyId: company.id });
      handleClose();
    },
  });

  const goToNextStep = () => {
    setCurrentStep(Math.min(sections.length - 1, currentStep + 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const handleClose = () => {
    setCurrentStep(0);
    setRequireReleaseDocument(true);
    form.reset();
    mutation.reset();
    onOpenChange(false);
  };

  const handleDistributionSectionNext = () => {
    if (requireReleaseDocument) {
      goToNextStep();
    } else {
      form.handleSubmit((data) => mutation.mutate(data))();
    }
  };

  const sections = [
    <div key="distribution-form" className="space-y-4">
      <DialogHeader>
        <DialogTitle>Start a new distribution</DialogTitle>
        <DialogDescription>
          Set the record date, enter the distribution amount, and confirm shareholder eligibility to start your
          distribution round.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form className="space-y-4">
          <FormField
            control={form.control}
            name="return_of_capital"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type of distribution</FormLabel>
                <FormControl>
                  <RadioButtons
                    options={[
                      { label: "Dividend", value: false },
                      { label: "Return of capital", value: true },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    className="grid-flow-col"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distribution name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dividends_issuance_date"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <DatePicker {...field} label="Payment date" granularity="day" />
                </FormControl>
                <p className="text-muted-foreground text-sm">Funds will be paid out to eligible shareholders.</p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount_in_usd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total distribution amount</FormLabel>
                <FormControl>
                  <NumberInput
                    {...field}
                    value={field.value}
                    onChange={field.onChange}
                    prefix="$"
                    decimal
                    placeholder="0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Switch
            checked={requireReleaseDocument}
            onCheckedChange={setRequireReleaseDocument}
            label="Require a signed investor agreement before releasing funds."
          />
        </form>
      </Form>

      <DialogFooter>
        {requireReleaseDocument ? (
          <Button onClick={handleDistributionSectionNext} disabled={!form.formState.isValid}>
            Continue
          </Button>
        ) : (
          <MutationButton
            mutation={mutation}
            param={form.getValues()}
            errorText={mutation.error?.message}
            loadingText="Creating distribution..."
            disabled={!form.formState.isValid}
          >
            Create distribution
          </MutationButton>
        )}
      </DialogFooter>
    </div>,
    requireReleaseDocument ? (
      <div key="release-document" className="space-y-4">
        <DialogHeader>
          <DialogTitle>Investor release agreement</DialogTitle>
          <DialogDescription>
            Add a release agreement to waive post-payout claims. Investors will sign this before receiving funds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="release_document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreement template</FormLabel>
                    <FormControl>
                      <BasicRichTextEditor
                        onChange={field.onChange}
                        value={field.value || ""}
                        placeholder="Paste or type your release agreement here..."
                      />
                    </FormControl>
                    <p className="text-sm text-gray-500">
                      Must include <span className="font-bold">{"{{investor}}"}</span> and{" "}
                      <span className="font-bold">{"{{amount}}"}</span> to personalize the agreement.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={goToPreviousStep}>
            Back
          </Button>
          <MutationButton
            mutation={mutation}
            param={form.getValues()}
            errorText={mutation.error?.message}
            loadingText="Creating distribution..."
            disabled={!form.watch("release_document")?.trim()}
          >
            Create distribution
          </MutationButton>
        </DialogFooter>
      </div>
    ) : null,
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogStackContent step={currentStep}>{sections}</DialogStackContent>
    </Dialog>
  );
};

export default NewDistributionModal;
