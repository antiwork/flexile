"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { usStates } from "@/models";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
  name: z.string().min(1, "This field is required."),
  taxId: z.string().superRefine((val, ctx) => {
    const taxIdDigits = val.replace(/\D/gu, "");
    if (taxIdDigits.length !== 9)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please check that your EIN is 9 numbers long." });
    if (/^(\d)\1{8}$/u.test(taxIdDigits))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Your EIN can't have all identical digits." });
  }),
  phoneNumber: z
    .string()
    .min(1, "This field is required.")
    .refine((val) => val.replace(/\D/gu, "").length === 10, "Please enter a valid U.S. phone number."),
  streetAddress: z.string().min(1, "This field is required."),
  city: z.string().min(1, "This field is required."),
  state: z.string().min(1, "This field is required."),
  zipCode: z.string().min(1, "This field is required."),
});

export default function Details() {
  const company = useCurrentCompany();
  const [settings] = trpc.companies.settings.useSuspenseQuery({ companyId: company.id });
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: settings.name ?? "",
      taxId: settings.taxId ?? "",
      phoneNumber: settings.phoneNumber ?? "",
      streetAddress: company.address.street_address ?? "",
      city: company.address.city ?? "",
      state: company.address.state ?? "",
      zipCode: company.address.zip_code ?? "",
    },
  });

  const updateSettings = trpc.companies.update.useMutation({
    onSuccess: async () => {
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setTimeout(() => updateSettings.reset(), 2000);
    },
  });

  const onSubmit = form.handleSubmit((values) => updateSettings.mutate({ companyId: company.id, ...values }));

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/gu, "");
    if (digits.length < 10) return digits;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const formatTaxId = (value: string) => {
    const digits = value.replace(/\D/gu, "");
    if (digits.length < 3) return digits;
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-xl font-medium">Details</h2>
        <p className="text-muted-foreground text-base">
          These details will be included in tax forms, as well as in your contractor's invoices.
        </p>
      </hgroup>
      <Form {...form}>
        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company's legal name</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>EIN</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="XX-XXXXXXX"
                    onChange={(e) => field.onChange(formatTaxId(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="(000) 000-0000"
                    onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="streetAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Residential address (street name, number, apt)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City or town</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      placeholder="Choose State"
                      options={usStates.map(({ name, code }) => ({ value: code, label: name }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="text-xs">Flexile is only available for companies based in the United States.</div>
        </div>
        <MutationStatusButton
          mutation={updateSettings}
          type="submit"
          loadingText="Saving..."
          successText="Changes saved"
          className="w-fit"
        >
          Save changes
        </MutationStatusButton>
      </Form>
    </form>
  );
}
