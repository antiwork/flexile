"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import Modal from "@/components/Modal";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/global";
import { countries, sanctionedCountries } from "@/models/constants";
import { request } from "@/utils/request";
import { onboarding_path } from "@/utils/routes";

const formSchema = z.object({
  legal_name: z.string().refine((val) => /\S+\s+\S+/u.test(val), "This doesn't look like a complete full name."),
  preferred_name: z.string().min(1, "This field is required"),
  country_code: z.string().min(1, "This field is required"),
  citizenship_country_code: z.string().min(1, "This field is required"),
});

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

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legal_name: data.legal_name || "",
      preferred_name: data.preferred_name || "",
      country_code: data.country_code || "",
      citizenship_country_code: data.citizenship_country_code || "",
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      await request({
        method: "PATCH",
        url: onboarding_path(),
        accept: "json",
        jsonData: { user: form.getValues() },
        assertOk: true,
      });
      router.push(nextLinkTo);
    },
  });

  const submit = form.handleSubmit((values) => {
    if (!confirmNoPayout && sanctionedCountries.has(values.country_code)) {
      setModalOpen(true);
      throw new Error("Sanctioned country");
    }

    save.mutate();
  });

  const countryOptions = [...countries].map(([code, name]) => ({ value: code, label: name }));

  return (
    <>
      <Form {...form}>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <FormField
            control={form.control}
            name="legal_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full legal name (must match your ID)</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferred_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred name (visible to others)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={form.control}
              name="country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country of residence</FormLabel>
                  <FormControl>
                    <ComboBox {...field} placeholder="Select country" options={countryOptions} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="citizenship_country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country of citizenship</FormLabel>
                  <FormControl>
                    <ComboBox {...field} placeholder="Select country" options={countryOptions} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <footer className="grid items-center gap-2">
            <MutationStatusButton type="submit" mutation={save} loadingText="Saving...">
              Continue
            </MutationStatusButton>
          </footer>
        </form>
      </Form>

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
              save.mutate();
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
