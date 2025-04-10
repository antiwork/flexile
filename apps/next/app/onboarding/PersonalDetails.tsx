"use client";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Set } from "immutable";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import Select from "@/components/Select";
import { useCurrentUser } from "@/global";
import { countries, sanctionedCountries } from "@/models/constants";
import { e } from "@/utils";
import { request } from "@/utils/request";
import { onboarding_path } from "@/utils/routes";

const PersonalDetails = <T extends string>({ nextLinkTo }: { nextLinkTo: Route<T> }) => {
  const user = useCurrentUser();
  const router = useRouter();
  const { data } = useSuspenseQuery({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const response = await request({ method: "GET", url: onboarding_path(), accept: "json", assertOk: true });
      return z
        .object({
          legal_name: z.string().nullable(),
          preferred_name: z.string().nullable(),
          country_code: z.string().nullable(),
          citizenship_country_code: z.string().nullable(),
        })
        .parse(await response.json());
    },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmNoPayout, setConfirmNoPayout] = useState(false);
  const [errors, setErrors] = useState(Set<string>());

  const [legalName, setLegalName] = useState(data.legal_name);
  const [preferredName, setPreferredName] = useState(data.preferred_name);
  const [country, setCountry] = useState(data.country_code);
  const [citizenshipCountry, setCitizenshipCountry] = useState(data.citizenship_country_code);
  const formData = {
    legal_name: legalName,
    preferred_name: preferredName,
    country_code: country,
    citizenship_country_code: citizenshipCountry,
  };
  Object.entries(formData).forEach(([key, value]) => useEffect(() => setErrors(errors.delete(key)), [value]));

  const submit = useMutation({
    mutationFn: async () => {
      const newErrors = errors.clear().withMutations((errors) => {
        Object.entries(formData).forEach(([field, value]) => {
          if (!value) errors.add(field);
        });

        if (!/\S+\s+\S+/u.test(legalName || "")) errors.add("legal_name");
      });

      setErrors(newErrors);
      if (newErrors.size > 0) throw new Error("Invalid data");

      if (!confirmNoPayout && sanctionedCountries.has(country || "")) {
        setModalOpen(true);
        throw new Error("Sanctioned country");
      }

      await request({
        method: "PATCH",
        url: onboarding_path(),
        accept: "json",
        jsonData: { user: formData },
        assertOk: true,
      });
      router.push(nextLinkTo);
    },
  });

  const countryOptions = [...countries].map(([code, name]) => ({ value: code, label: name }));

  return (
    <>
      <form className="grid gap-4" onSubmit={e(() => submit.mutate(), "prevent")}>
        <Input
          value={legalName}
          onChange={setLegalName}
          label="Full legal name (must match your ID)"
          invalid={errors.has("legal_name")}
          autoFocus
          help={errors.has("legal_name") ? "This doesn't look like a complete full name." : undefined}
        />
        <Input
          value={preferredName}
          onChange={setPreferredName}
          label="Preferred name (visible to others)"
          invalid={errors.has("preferred_name")}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            value={country}
            onChange={setCountry}
            placeholder="Select country"
            options={countryOptions}
            label="Country of residence"
            invalid={errors.has("country_code")}
          />
          <Select
            value={citizenshipCountry}
            onChange={setCitizenshipCountry}
            placeholder="Select country"
            options={countryOptions}
            label="Country of citizenship"
          />
        </div>
        <footer className="grid items-center gap-2">
          <MutationButton mutation={submit} loadingText="Saving...">
            Continue
          </MutationButton>
        </footer>
      </form>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Important notice">
        <p>
          Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from
          sanctioned countries are unable to receive payments through our platform.
        </p>
        <p>
          You can still use Flexile's features such as
          {user.roles.worker ? " sending invoices and " : " "} receiving equity, but
          <b> you won't be able to set a payout method or receive any payments</b>.
        </p>
        <div className="modal-footer">
          <Button
            onClick={() => {
              setConfirmNoPayout(true);
              setModalOpen(false);
              submit.mutate();
            }}
          >
            Proceed
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default PersonalDetails;
