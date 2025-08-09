import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { Button } from "@/components/ui/button";
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
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ["dividendComputations", company.id] });
      handleClose();
    },
  });

  const handleClose = () => {
    form.reset();
    mutation.reset();
    onOpenChange(false);
  };

  const submit = form.handleSubmit((values: FormValues) => mutation.mutateAsync(values));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new distribution</DialogTitle>
          <DialogDescription>
            Set the record date, enter the distribution amount, and confirm shareholder eligibility to start your
            distribution round.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
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
                    <NumberInput value={field.value} onChange={field.onChange} prefix="$" decimal placeholder="0" />
                  </FormControl>
                  <p className="text-muted-foreground text-sm">Funds will be paid out to eligible shareholders.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isValid || mutation.isPending}>
                Create distribution
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default NewDistributionModal;
