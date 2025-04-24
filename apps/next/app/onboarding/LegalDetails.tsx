"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import OnboardingLayout from "@/components/layouts/Onboarding";
import { linkClasses } from "@/components/Link";
import { MutationStatusButton } from "@/components/MutationButton";
import RadioButtons from "@/components/RadioButtons";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getTinName } from "@/utils/legal";
import { request } from "@/utils/request";
import { legal_onboarding_path, save_legal_onboarding_path } from "@/utils/routes";
import LegalCertificationModal from "./LegalCertificationModal";

const formSchema = z.object({
  business_entity: z.boolean(),
  business_name: z.string().nullish(),
  tax_id: z.string().nullish(),
  birth_date: z.string().nullish(),
  street_address: z.string().min(1, "This field is required"),
  state: z.string().min(1, "This field is required"),
  city: z.string().min(1, "This field is required"),
  zip_code: z.string().regex(/\d/u, { message: "This doesn't look like a valid ZIP code" }),
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
      ...data.user,
      street_address: data.user.street_address || "",
      state: data.user.state || "",
      city: data.user.city || "",
      zip_code: data.user.zip_code || "",
    },
  });

  const isBusinessEntity = form.watch("business_entity");
  const tinDigits = form.watch("tax_id")?.replace(/\D/gu, "");
  const tinName = getTinName(isBusinessEntity);

  useEffect(() => {
    if (data.user.is_foreign || !tinDigits) return;

    const parts = isBusinessEntity ? [2, 7] : [3, 2, 4];
    let lastIndex = 0;
    form.setValue("tax_id", parts.flatMap((part) => tinDigits.slice(lastIndex, (lastIndex += part)) || []).join(" - "));
  }, [tinDigits, isBusinessEntity]);

  const save = useMutation({
    mutationFn: async (signature: string) => {
      if (data.user.collect_tax_info && !signature) {
        setSignModalOpen(true);
        throw new Error("Signature required");
      }

      await request({
        method: "PATCH",
        url: save_legal_onboarding_path(),
        accept: "json",
        jsonData: { user: form.getValues() },
        assertOk: true,
      });
      router.push(nextLinkTo);
    },
  });

  const submit = form.handleSubmit((values) => {
    if (data.user.collect_tax_info && !values.birth_date)
      return form.setError("birth_date", { message: "This field is required" });
    if (!data.user.is_foreign && data.user.collect_tax_info && tinDigits?.length !== 9)
      return form.setError("tax_id", { message: "This doesn't look like a valid tax ID" });
    if (data.user.collect_tax_info) return setSignModalOpen(true);
    save.mutate("");
  });

  return (
    <OnboardingLayout stepIndex={steps.indexOf("Billing info")} steps={steps} title={header} subtitle={subheading}>
      <Form {...form}>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <RadioButtons
            value={isBusinessEntity.toString()}
            onChange={(value) => form.setValue("business_entity", value === "true")}
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
                  <FormMessage>
                    {!data.user.is_foreign ? (
                      <>
                        Please ensure this information matches the business name you used on your{" "}
                        <Link href="https://www.irs.gov/businesses/small-businesses-self-employed/online-ein-frequently-asked-questions#:~:text=how%20best%20to%20enter%20your%20business%20name%20into%20the%20online%20EIN%20application">
                          EIN application
                        </Link>
                      </>
                    ) : null}
                  </FormMessage>
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
                    <FormLabel>
                      {data.user.is_foreign
                        ? "Foreign tax identification number"
                        : `Tax identification number (${tinName})`}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage>
                      {data.user.is_foreign
                        ? "We use this for identity verification and tax reporting."
                        : `We use your ${tinName} for identity verification and tax reporting.`}{" "}
                      Rest assured, your information is encrypted and securely stored.
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                <FormLabel>Residential address (street name, number, apartment)</FormLabel>
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
                  <FormLabel>City</FormLabel>
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
                      placeholder="Select state"
                      options={data.states.map(([label, value]) => ({ value, label }))}
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
                  <FormLabel>{data.user.zip_code_label}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
            mutation={save}
          />

          <footer className="grid items-center gap-2">
            <MutationStatusButton mutation={save} type="submit" loadingText="Saving...">
              Continue
            </MutationStatusButton>
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
