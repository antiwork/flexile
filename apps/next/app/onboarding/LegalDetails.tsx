"use client";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Set } from "immutable";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import Input from "@/components/Input";
import OnboardingLayout from "@/components/layouts/Onboarding";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import RadioButtons from "@/components/RadioButtons";
import Select from "@/components/Select";
import { e } from "@/utils";
import { getTinName } from "@/utils/legal";
import { request } from "@/utils/request";
import { legal_onboarding_path, save_legal_onboarding_path } from "@/utils/routes";
import LegalCertificationModal from "./LegalCertificationModal";

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
  const [errors, setErrors] = useState(Set<string>());
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

  const [isBusinessEntity, setIsBusinessEntity] = useState(data.user.business_entity);
  const [businessName, setBusinessName] = useState(data.user.business_name);
  const [tin, setTin] = useState(data.user.tax_id);
  const [birthDate, setBirthDate] = useState(data.user.birth_date);
  const [streetAddress, setStreetAddress] = useState(data.user.street_address);
  const [state, setState] = useState(data.user.state);
  const [city, setCity] = useState(data.user.city);
  const [zipCode, setZipCode] = useState(data.user.zip_code);

  const tinDigits = tin?.replace(/\D/gu, "");
  const tinName = getTinName(isBusinessEntity);

  useEffect(() => {
    if (data.user.is_foreign || !tinDigits) return;

    const parts = isBusinessEntity ? [2, 7] : [3, 2, 4];
    let lastIndex = 0;
    setTin(parts.flatMap((part) => tinDigits.slice(lastIndex, (lastIndex += part)) || []).join(" - "));
  }, [tinDigits]);

  const formData = {
    tax_id: tin,
    business_name: businessName,
    birth_date: birthDate,
    street_address: streetAddress,
    state,
    city,
    zip_code: zipCode,
  };
  Object.entries(formData).forEach(([key, value]) => useEffect(() => setErrors(errors.delete(key)), [value]));

  const submit = useMutation({
    mutationFn: async (signature: string) => {
      const newErrors = errors.clear().withMutations((errors) => {
        for (const [key, value] of Object.entries(formData)) {
          if (!isBusinessEntity && key === "business_name") continue;
          if (!data.user.collect_tax_info && key === "birth_date") continue;
          if (key !== "tax_id" && !value) errors.add(key);
        }
        // Only validate US tax ID format for US users
        if (!data.user.is_foreign && data.user.collect_tax_info && tinDigits?.length !== 9) errors.add("tax_id");
        // For ZIP codes, just check that they contain at least one number
        if (formData.zip_code && !/\d/u.test(formData.zip_code)) errors.add("zip_code");
      });
      setErrors(newErrors);
      if (newErrors.size > 0) throw new Error("Invalid form data");

      if (data.user.collect_tax_info && !signature) {
        setSignModalOpen(true);
        throw new Error("Signature required");
      }

      await request({
        method: "PATCH",
        url: save_legal_onboarding_path(),
        accept: "json",
        jsonData: { user: { ...formData, signature, business_entity: isBusinessEntity } },
        assertOk: true,
      });
      router.push(nextLinkTo);
    },
  });

  return (
    <OnboardingLayout stepIndex={steps.indexOf("Billing info")} steps={steps} title={header} subtitle={subheading}>
      <form className="grid gap-4" onSubmit={e(() => submit.mutate(""), "prevent")}>
        <RadioButtons
          value={isBusinessEntity.toString()}
          onChange={(value) => setIsBusinessEntity(value === "true")}
          label="Legal entity"
          options={[
            { label: "I'm an individual", value: "false" },
            { label: "I'm a business", value: "true" },
          ]}
        />

        {isBusinessEntity ? (
          <Input
            value={businessName}
            onChange={setBusinessName}
            label="Full legal name of entity"
            disabled={!!data.user.business_name}
            invalid={errors.has("business_name")}
            help={
              !data.user.is_foreign ? (
                <>
                  Please ensure this information matches the business name you used on your{" "}
                  <Link href="https://www.irs.gov/businesses/small-businesses-self-employed/online-ein-frequently-asked-questions#:~:text=how%20best%20to%20enter%20your%20business%20name%20into%20the%20online%20EIN%20application">
                    EIN application
                  </Link>
                </>
              ) : undefined
            }
          />
        ) : null}

        {data.user.collect_tax_info ? (
          <>
            <Input
              value={tin}
              onChange={setTin}
              invalid={errors.has("tax_id")}
              label={
                data.user.is_foreign ? "Foreign tax identification number" : `Tax identification number (${tinName})`
              }
              help={
                errors.has("tax_id") && !data.user.is_foreign
                  ? `Your ${tinName} is too short. Make sure it contains 9 numerical characters.`
                  : `${
                      data.user.is_foreign
                        ? "We use this for identity verification and tax reporting."
                        : `We use your ${tinName} for identity verification and tax reporting.`
                    } Rest assured, your information is encrypted and securely stored.`
              }
            />

            <Input
              value={birthDate}
              onChange={setBirthDate}
              type="date"
              label="Date of birth"
              invalid={errors.has("birth_date")}
            />
          </>
        ) : null}

        <Input
          value={streetAddress}
          onChange={setStreetAddress}
          label="Residential address (street name, number, apartment)"
          invalid={errors.has("street_address")}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Input value={city} onChange={setCity} label="City" invalid={errors.has("city")} />

          <Select
            value={state}
            onChange={setState}
            placeholder="Select state"
            options={data.states.map(([label, value]) => ({ value, label }))}
            label="State"
            invalid={errors.has("state")}
          />

          <Input
            value={zipCode}
            onChange={setZipCode}
            label={data.user.zip_code_label}
            invalid={errors.has("zip_code")}
          />
        </div>

        <LegalCertificationModal
          open={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          legalName={data.user.legal_name}
          isForeignUser={data.user.is_foreign}
          isBusiness={isBusinessEntity}
          sticky
          mutation={submit}
        />

        <footer className="grid items-center gap-2">
          <MutationButton mutation={submit} param="" type="submit" loadingText="Saving...">
            Continue
          </MutationButton>
          <Link href={prevLinkTo} className={linkClasses}>
            Back to Personal details
          </Link>
        </footer>
      </form>
    </OnboardingLayout>
  );
};

export default LegalDetails;
