import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Set } from "immutable";
import { useState } from "react";
import { z } from "zod";
import Input from "@/components/Input";
import MutationButton from "@/components/MutationButton";
import Select from "@/components/Select";
import { useCurrentUser } from "@/global";
import { usStates } from "@/models";
import { e } from "@/utils";
import { request } from "@/utils/request";
import { company_administrator_onboarding_path, details_company_administrator_onboarding_path } from "@/utils/routes";

export const CompanyDetails = () => {
  const user = useCurrentUser();
  const [errors, setErrors] = useState(Set<string>());
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery({
    queryKey: ["administratorOnboardingDetails", user.currentCompanyId],
    queryFn: async () => {
      const response = await request({
        url: details_company_administrator_onboarding_path(user.currentCompanyId || "_"),
        method: "GET",
        accept: "json",
        assertOk: true,
      });
      return z
        .object({
          company: z.object({
            name: z.string().nullable(),
            street_address: z.string().nullable(),
            city: z.string().nullable(),
            state: z.string().nullable(),
            zip_code: z.string().nullable(),
          }),
          states: z.array(z.tuple([z.string(), z.string()])),
          legal_name: z.string().nullable(),
          on_success_redirect_path: z.string(),
        })
        .parse(await response.json());
    },
  });
  const [legalName, setLegalName] = useState(data.legal_name || "");
  const [companyName, setCompanyName] = useState(data.company.name || "");
  const [streetAddress, setStreetAddress] = useState(data.company.street_address || "");
  const [city, setCity] = useState(data.company.city || "");
  const [state, setState] = useState(data.company.state || "");
  const [zipCode, setZipCode] = useState(data.company.zip_code || "");
  const companyData = { name: companyName, street_address: streetAddress, city, state, zip_code: zipCode };
  const submit = useMutation({
    mutationFn: async () => {
      const newErrors = errors.clear().withMutations((errors) => {
        Object.entries(companyData).forEach(([key, value]) => {
          if (!value) errors.add(key);
        });
        // For US companies, validate ZIP code format; otherwise just check for numbers
        if (zipCode && !/\d/u.test(zipCode)) {
          errors.add("zip_code");
        }
        if (!/\S+\s+\S+/u.test(legalName)) errors.add("legal_name");
      });

      setErrors(newErrors);
      if (newErrors.size) throw new Error("Invalid data");

      await request({
        method: "PATCH",
        accept: "json",
        url: company_administrator_onboarding_path(user.currentCompanyId || "_"),
        assertOk: true,
        jsonData: { company: companyData, legal_name: legalName },
      });

      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  return (
    <form className="grid gap-4" onSubmit={e(() => submit.mutate(), "prevent")}>
      <Input
        value={legalName}
        onChange={setLegalName}
        label="Your full legal name"
        invalid={errors.has("legal_name")}
        help={errors.has("legal_name") ? "This doesn't look like a complete full name" : undefined}
        autoFocus
      />
      <Input
        value={companyName}
        onChange={setCompanyName}
        label="Your company's legal name"
        invalid={errors.has("name")}
      />
      <Input
        value={streetAddress}
        onChange={setStreetAddress}
        label="Street address, apt number"
        invalid={errors.has("street_address")}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Input value={city} onChange={setCity} label="City" invalid={errors.has("city")} />
        <Select
          value={state}
          onChange={setState}
          placeholder="Choose State"
          options={usStates.map(({ name, code }) => ({ value: code, label: name }))}
          label="State"
          invalid={errors.has("state")}
        />
        <Input
          value={zipCode}
          onChange={setZipCode}
          label="ZIP code"
          invalid={errors.has("zip_code")}
          help={errors.has("zip_code") ? "Enter a valid ZIP code (5 or 9 digits)" : undefined}
        />
      </div>
      <div className="text-xs">Flexile is only available for companies based in the United States.</div>
      <MutationButton mutation={submit} idleVariant="primary" type="submit" loadingText="Saving...">
        Continue
      </MutationButton>
    </form>
  );
};
