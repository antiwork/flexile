"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Map } from "immutable";
import { useEffect, useState } from "react";
import { CardRow } from "@/components/Card";
import FormSection from "@/components/FormSection";
import { Input } from "@/components/ui/input";
import MutationButton from "@/components/MutationButton";
import Select from "@/components/Select";
import { useCurrentCompany } from "@/global";
import { usStates } from "@/models";
import { trpc } from "@/trpc/client";

export default function Details() {
  const company = useCurrentCompany();
  const [settings] = trpc.companies.settings.useSuspenseQuery({ companyId: company.id });
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [name, setName] = useState(settings.name ?? "");
  const [taxId, setTaxId] = useState(settings.taxId ?? "");
  const [phoneNumber, setPhoneNumber] = useState(settings.phoneNumber ?? "");
  const [streetAddress, setStreetAddress] = useState(company.address.street_address ?? "");
  const [city, setCity] = useState(company.address.city ?? "");
  const [state, setState] = useState(company.address.state ?? "");
  const [zipCode, setZipCode] = useState(company.address.zip_code ?? "");
  const data = { name, taxId, phoneNumber, streetAddress, city, state, zipCode };
  const [errors, setErrors] = useState(Map<string, string>());
  Object.entries(data).forEach(([key, value]) => useEffect(() => setErrors(errors.delete(key)), [value]));

  const updateSettings = trpc.companies.update.useMutation();
  const saveMutation = useMutation({
    mutationFn: async () => {
      const newErrors = errors.clear().withMutations((errors) => {
        Object.entries(data).forEach(([key, value]) => {
          if (!value) errors.set(key, "This field is required.");
        });

        if (data.phoneNumber.replace(/\D/gu, "").length !== 10) {
          errors.set("phoneNumber", "Please enter a valid U.S. phone number.");
        }

        const taxIdDigits = taxId.replace(/\D/gu, "");
        if (taxIdDigits.length !== 9) errors.set("taxId", "Please check that your EIN is 9 numbers long.");
        else if (/^(\d)\1{8}$/u.test(taxIdDigits)) errors.set("taxId", "Your EIN can't have all identical digits.");
      });
      setErrors(newErrors);
      if (newErrors.size > 0) throw new Error("Invalid form data");

      await updateSettings.mutateAsync({ companyId: company.id, ...data });
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  return (
    <FormSection
      title="Details"
      description="These details will be included in tax forms, as well as in your contractor's invoices."
    >
      <CardRow className="grid gap-4">
        <Input value={name} onChange={setName} label="Company's legal name" invalid={errors.has("name")} autoFocus />
        <Input
          value={taxId}
          onChange={(value: string) => setTaxId(formatTaxId(value))}
          label="EIN"
          placeholder="XX-XXXXXXX"
          invalid={errors.has("taxId")}
          help={errors.get("taxId")}
        />
        <Input
          value={phoneNumber}
          onChange={(value: string) => setPhoneNumber(formatPhoneNumber(value))}
          label="Phone number"
          placeholder="(000) 000-0000"
          invalid={errors.has("phoneNumber")}
          help={errors.get("phoneNumber")}
        />
        <Input
          value={streetAddress}
          onChange={setStreetAddress}
          label="Residential address (street name, number, apt)"
          invalid={errors.has("streetAddress")}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={city} onChange={setCity} label="City or town" invalid={errors.has("city")} />
          <Select
            value={state || undefined}
            onChange={setState}
            placeholder="Choose State"
            options={usStates.map(({ name, code }) => ({ value: code, label: name }))}
            label="State"
            invalid={errors.has("state")}
          />
          <Input value={zipCode} onChange={setZipCode} label="Postal code" invalid={errors.has("zipCode")} />
        </div>
        <Select
          value=""
          onChange={(value) => value}
          placeholder="United States"
          options={[]}
          label="Country"
          disabled
          help="Flexile is currently available only to companies incorporated in the United States."
        />
      </CardRow>

      <CardRow>
        <MutationButton mutation={saveMutation} loadingText="Saving..." successText="Changes saved">
          Save changes
        </MutationButton>
      </CardRow>
    </FormSection>
  );
}

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
