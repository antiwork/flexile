import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  dividends_issuance_date: z.instanceof(CalendarDate, { message: "This field is required." }),
  amount_in_usd: z.number().min(0.01, "Amount must be greater than 0"),
});

type FormValues = z.infer<typeof schema>;

const NewDistributionModal = ({ open, onOpenChange }: NewDistributionModalProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      return_of_capital: false,
      dividends_issuance_date: today(getLocalTimeZone()),
      amount_in_usd: 0,
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

  const handleClose = () => {
    form.reset();
    mutation.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <div className="space-y-4">
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
                name="dividends_issuance_date"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DatePicker {...field} label="Payment date" granularity="day" />
                    </FormControl>
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
                    <p className="text-muted-foreground text-sm">Funds will be paid out to eligible shareholders.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter>
            <MutationButton
              mutation={mutation}
              param={form.getValues()}
              errorText={mutation.error?.message}
              loadingText="Creating distribution..."
              disabled={!form.formState.isValid}
            >
              Create distribution
            </MutationButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewDistributionModal;
