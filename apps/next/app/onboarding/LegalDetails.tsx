"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
// import { Set } from "immutable";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import OnboardingLayout from "@/components/layouts/Onboarding";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import RadioButtons from "@/components/RadioButtons";
import Select from "@/components/Select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getTinName } from "@/utils/legal";
import { request } from "@/utils/request";
import { legal_onboarding_path, save_legal_onboarding_path } from "@/utils/routes";
import LegalCertificationModal from "./LegalCertificationModal";

const formSchema = z.object({
  business_entity: z.boolean(),
  business_name: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  street_address: z.string().min(1, "This field is required"),
  state: z.string().min(1, "This field is required"),
  city: z.string().min(1, "This field is required"),
  zip_code: z.string().refine(
    (val) => !val || /\d/u.test(val), 
    { message: "ZIP code must contain at least one number" }
  ),
}).superRefine((data, ctx) => {
  if (data.business_entity && !data.business_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "This field is required",
      path: ["business_name"],
    });
  }
  
  if (data.tax_id && data.tax_id.replace(/\D/gu, "").length !== 9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Your tax ID is too short. Make sure it contains 9 numerical characters.",
      path: ["tax_id"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

const LegalDetails = <T extends string>({
  header,
  subheading,
  nextLinkTo,
  prevLinkTo,
  steps,
}: {
  header: string;
  subheading: string;
  nextLinkTo: Route<T>;
  prevLinkTo: Route<T>;
  steps: string[];
}) => {
  const router = useRouter();
  const [signModalOpen, setSignModalOpen] = useState(false);
  
  const { data } = useSuspenseQuery({
    queryKey: ["onboardingLegalDetails"],
    queryFn: async () => {
      const response = await request({ method: "GET", url: legal_onboarding_path(), accept: "json", assertOk: true });
      return z
        .object({
          user: z.object({
            collect_tax_info: z.boolean(),
            business_entity: z.boolean(),
            business_name: z.string().nullable(),
            legal_name: z.string(),
            is_foreign: z.boolean(),
            tax_id: z.string().nullable(),
            birth_date: z.string().nullable(),
            street_address: z.string().nullable(),
            city: z.string().nullable(),
            state: z.string().nullable(),
            zip_code: z.string().nullable(),
            zip_code_label: z.string(),
          }),
          states: z.array(z.tuple([z.string(), z.string()])),
        })
        .parse(await response.json());
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_entity: data.user.business_entity,
      business_name: data.user.business_name || null,
      tax_id: data.user.tax_id || null,
      birth_date: data.user.birth_date || null,
      street_address: data.user.street_address || "",
      state: data.user.state || "",
      city: data.user.city || "",
      zip_code: data.user.zip_code || "",
    },
  });

  const [isBusinessEntity, setIsBusinessEntity] = useState(data.user.business_entity);
  
  const tin = form.watch("tax_id");
  const tinDigits = tin?.replace(/\D/gu, "");
  const tinName = getTinName(isBusinessEntity);

  useEffect(() => {
    if (data.user.is_foreign || !tinDigits) return;

    const parts = isBusinessEntity ? [2, 7] : [3, 2, 4];
    let lastIndex = 0;
    const formattedTin = parts.flatMap((part) => tinDigits.slice(lastIndex, (lastIndex += part)) || []).join(" - ");
    form.setValue("tax_id", formattedTin);
  }, [tinDigits, isBusinessEntity, data.user.is_foreign, form]);

  const submit = useMutation({
    mutationFn: async (values: FormValues) => {
      if (data.user.collect_tax_info && !values.tax_id) {
        setSignModalOpen(true);
        throw new Error("Signature required");
      }

      await request({
        method: "PATCH",
        url: save_legal_onboarding_path(),
        accept: "json",
        jsonData: { 
          user: { 
            ...values,
            business_entity: isBusinessEntity,
          } 
        },
        assertOk: true,
      });
      router.push(nextLinkTo);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (data.user.collect_tax_info && !values.tax_id) {
      setSignModalOpen(true);
      return;
    }
    submit.mutate(values);
  });

  return (
    <OnboardingLayout stepIndex={steps.indexOf("Billing info")} steps={steps} title={header} subtitle={subheading}>
      <Form {...form}>
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}>
          <RadioButtons
            value={isBusinessEntity.toString()}
            onChange={(value) => {
              setIsBusinessEntity(value === "true");
              form.setValue("business_entity", value === "true");
            }}
            label="Legal entity"
            options={[
              { label: "I'm an individual", value: "false" },
              { label: "I'm a business", value: "true" },
            ]}
          />

          {isBusinessEntity ? (
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="business-name">Full legal name of entity</FormLabel>
                  <FormControl>
                    <Input
                      id="business-name"
                      {...field}
                      value={field.value || ""}
                      disabled={!!data.user.business_name}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-gray-500">
                    {!data.user.is_foreign ? (
                      <>
                        Please ensure this information matches the business name you used on your{" "}
                        <Link href="https://www.irs.gov/businesses/small-businesses-self-employed/online-ein-frequently-asked-questions#:~:text=how%20best%20to%20enter%20your%20business%20name%20into%20the%20online%20EIN%20application">
                          EIN application
                        </Link>
                      </>
                    ) : null}
                  </p>
                </FormItem>
              )}
            />
          ) : null}

          {data.user.collect_tax_info ? (
            <>
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="tin">
                      {data.user.is_foreign ? "Foreign tax identification number" : `Tax identification number (${tinName})`}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="tin"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">
                      {data.user.is_foreign
                        ? "We use this for identity verification and tax reporting."
                        : `We use your ${tinName} for identity verification and tax reporting.`
                      } Rest assured, your information is encrypted and securely stored.
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="birth-date">Date of birth</FormLabel>
                    <FormControl>
                      <Input
                        id="birth-date"
                        type="date"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}

          <FormField
            control={form.control}
            name="street_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="street-address">Residential address (street name, number, apartment)</FormLabel>
                <FormControl>
                  <Input
                    id="street-address"
                    {...field}
                    value={field.value || ""}
                  />
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
                  <FormLabel htmlFor="city">City</FormLabel>
                  <FormControl>
                    <Input
                      id="city"
                      {...field}
                      value={field.value || ""}
                    />
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
                    <Select
                      value={field.value}
                      placeholder="Select state"
                      options={data.states.map(([label, value]) => ({ value, label }))}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zip_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="zip-code">{data.user.zip_code_label}</FormLabel>
                  <FormControl>
                    <Input
                      id="zip-code"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <LegalCertificationModal
            open={signModalOpen}
            onClose={() => setSignModalOpen(false)}
            legalName={data.user.legal_name}
            isForeignUser={data.user.is_foreign}
            isBusiness={isBusinessEntity}
            sticky
            mutation={useMutation({
              mutationFn: (_signature: string) => {
                return submit.mutateAsync(form.getValues());
              }
            })}
          />

          <footer className="grid items-center gap-2">
            <MutationButton mutation={submit} param={form.getValues()} type="submit" loadingText="Saving...">
              Continue
            </MutationButton>
            <Link href={prevLinkTo} className={linkClasses}>
              Back to Personal details
            </Link>
          </footer>
        </form>
      </Form>
    </OnboardingLayout>
  );
};

export default LegalDetails;
