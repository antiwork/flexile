"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import MainLayout from "@/components/layouts/Main";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
  name: z.string().min(1, "This field is required."),
  description: z.string().optional(),
  exitAmount: z.number().min(0),
  exitDate: z.instanceof(CalendarDate),
});

export default function NewScenario() {
  const company = useCurrentCompany();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      exitAmount: 0,
      exitDate: today(getLocalTimeZone()),
    },
  });

  const mutation = trpc.liquidationScenarios.run.useMutation({
    onSuccess: (scenario) => {
      router.push(`/equity/waterfall/${scenario.id}`);
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await mutation.mutateAsync({
      companyId: company.id,
      name: values.name,
      description: values.description || undefined,
      exitAmountCents: BigInt(Math.round(values.exitAmount * 100)),
      exitDate: values.exitDate.toDate(tz).toISOString(),
    });
  });

  return (
    <MainLayout
      title="New scenario"
      headerActions={
        <Button variant="outline" asChild>
          <a href="/equity/waterfall">Cancel</a>
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="exitAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exit amount</FormLabel>
                <FormControl>
                  <NumberInput {...field} decimal prefix="$" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="exitDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <DatePicker {...field} label="Exit date" granularity="day" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <MutationStatusButton type="submit" mutation={mutation} className="justify-self-end" loadingText="Creating...">
            Create scenario
          </MutationStatusButton>
        </form>
      </Form>
    </MainLayout>
  );
}
