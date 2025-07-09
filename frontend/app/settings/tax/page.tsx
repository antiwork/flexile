"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, type UseMutationResult, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { iso31662 } from "iso-3166";
import { Eye, EyeOff, AlertTriangle, Info, ArrowUpRightFromSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import { CalendarDate, parseDate } from "@internationalized/date";
import RadioButtons from "@/components/RadioButtons";
import Status from "@/components/Status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BusinessType, TaxClassification } from "@/db/enums";
import { useCurrentUser } from "@/global";
import { countries } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { getTinName } from "@/utils/legal";
import { request } from "@/utils/request";
import { settings_tax_path } from "@/utils/routes";
import SettingsLayout from "@/app/settings/Layout";
import ComboBox from "@/components/ComboBox";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { linkClasses } from "@/components/Link";
import { Label } from "@/components/ui/label";

const dataSchema = z.object({
  birth_date: z.string().nullable(),
  business_name: z.string().nullable(),
  business_type: z.number().nullable(),
  tax_classification: z.number().nullable(),
  citizenship_country_code: z.string(),
  city: z.string().nullable(),
  country_code: z.string(),
  display_name: z.string(),
  business_entity: z.boolean(),
  is_foreign: z.boolean(),
  is_tax_information_confirmed: z.boolean(),
  legal_name: z.string(),
  signature: z.string(),
  state: z.string().nullable(),
  street_address: z.string().nullable(),
  tax_id: z.string().nullable(),
  tax_id_status: z.enum(["verified", "invalid"]).nullable(),
  zip_code: z.string().nullable(),
  contractor_for_companies: z.array(z.string()),
});

const formValuesSchema = z.object({
  legal_name: z.string().regex(/\S+\s+\S+/u, "This doesn't look like a complete full name."),
  citizenship_country_code: z.string(),
  business_entity: z.boolean(),
  business_name: z.string().nullable(),
  business_type: z.nativeEnum(BusinessType).nullable(),
  tax_classification: z.nativeEnum(TaxClassification).nullable(),
  country_code: z.string(),
  tax_id: z.string().min(1, "This field is required."),
  birth_date: z.instanceof(CalendarDate).nullable(),
  street_address: z.string().min(1, "Please add your residential address."),
  city: z.string().min(1, "Please add your city or town."),
  state: z.string(),
  zip_code: z.string().regex(/\d/u, "Please add a valid postal code (must contain at least one number)."),
});

const getIsForeign = (values: z.infer<typeof formValuesSchema>) =>
  values.citizenship_country_code !== "US" && values.country_code !== "US";

const formSchema = formValuesSchema
  .refine((data) => !data.business_entity || data.business_name, {
    path: ["business_name"],
    message: "Please add your business legal name.",
  })
  .refine((data) => getIsForeign(data) || !data.business_entity || data.business_type !== null, {
    path: ["business_type"],
    message: "Please select a business type.",
  })
  .refine((data) => data.business_type !== BusinessType.LLC || data.tax_classification !== null, {
    path: ["tax_classification"],
    message: "Please select a tax classification.",
  });

export default function TaxPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const updateTaxSettings = trpc.users.updateTaxSettings.useMutation();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery({
    queryKey: ["settings-tax"],
    queryFn: async () => {
      const response = await request({ accept: "json", method: "GET", url: settings_tax_path(), assertOk: true });
      return dataSchema.parse(await response.json());
    },
  });

  const [isTaxInfoConfirmed, setIsTaxInfoConfirmed] = useState(data.is_tax_information_confirmed);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [taxIdStatus, setTaxIdStatus] = useState(data.tax_id_status);
  const [maskTaxId, setMaskTaxId] = useState(true);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...data,
      tax_id: data.tax_id ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      zip_code: data.zip_code ?? "",
      street_address: data.street_address ?? "",
      birth_date: data.birth_date ? parseDate(data.birth_date) : null,
    },
  });

  const formValues = form.watch();
  const isForeign = getIsForeign(formValues);

  const countryCodePrefix = `${formValues.country_code}-`;
  const countrySubdivisions = iso31662.filter((entry) => entry.code.startsWith(countryCodePrefix));

  const tinName = getTinName(formValues.business_entity);
  const taxIdPlaceholder = !isForeign ? (formValues.business_entity ? "XX-XXXXXXX" : "XXX-XX-XXXX") : undefined;
  const zipCodeLabel = formValues.country_code === "US" ? "ZIP code" : "Postal code";
  const stateLabel = formValues.country_code === "US" ? "State" : "Province";
  const countryOptions = [...countries].map(([value, label]) => ({ value, label }));

  const normalizedTaxId = (taxId: string) => {
    if (isForeign) return taxId.toUpperCase().replace(/[^A-Z0-9]/gu, "");
    return taxId.replace(/[^0-9]/gu, "");
  };

  const formatUSTaxId = (value: string) => {
    if (isForeign) return value;

    const digits = value.replace(/\D/gu, "");
    if (formValues.business_entity) {
      return digits.replace(/^(\d{2})(\d{0,7})/u, (_, p1: string, p2: string) => (p2 ? `${p1}-${p2}` : p1));
    }
    return digits.replace(/^(\d{3})(\d{0,2})(\d{0,4})/u, (_, p1: string, p2: string, p3: string) => {
      if (p3) return `${p1}-${p2}-${p3}`;
      if (p2) return `${p1}-${p2}`;
      return p1;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (signature: string) => {
      const data = await updateTaxSettings.mutateAsync({ data: { ...form.getValues(), signature } });

      setIsTaxInfoConfirmed(true);
      if (form.getFieldState("tax_id").isDirty) setTaxIdStatus(null);
      if (data.documentId) {
        await trpcUtils.documents.list.invalidate();
        router.push(`/documents?sign=${data.documentId}`);
      } else setShowCertificationModal(false);
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const submit = form.handleSubmit((values) => {
    const isForeign = values.citizenship_country_code !== "US" && values.country_code !== "US";
    const tinName = getTinName(values.business_entity);

    if (!isForeign) {
      if (values.tax_id.length !== 9)
        return form.setError("tax_id", { message: `Please check that your ${tinName} is 9 numbers long.` });
      else if (/^(\d)\1{8}$/u.test(values.tax_id))
        return form.setError("tax_id", { message: `Your ${tinName} can't have all identical digits.` });
    }

    if (values.country_code === "US" && !/(^\d{5}|\d{9}|\d{5}[- ]\d{4})$/u.test(values.zip_code))
      return form.setError("zip_code", { message: "Please add a valid ZIP code (5 or 9 digits)." });
    setShowCertificationModal(true);
  });

  return (
    <SettingsLayout>
      <Form {...form}>
        <form onSubmit={(e) => void submit(e)} className="grid gap-8">
          <hgroup>
            <h2 className="mb-1 text-xl font-bold">Tax information</h2>
            <p className="text-muted-foreground text-base">
              These details will be included in your {user.roles.worker ? "invoices and " : ""}applicable tax forms.
            </p>
          </hgroup>
          <div className="grid gap-4">
            {!isTaxInfoConfirmed && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>
                  Confirm your tax information to avoid delays on your payments or additional tax withholding.
                </AlertDescription>
              </Alert>
            )}

            {taxIdStatus === "invalid" && (
              <Alert>
                <Info />
                <AlertTitle>Review your tax information</AlertTitle>
                <AlertDescription>
                  Since there's a mismatch between the legal name and {tinName} you provided and your government
                  records, please note that your payments could experience a tax withholding rate of 24%. If you think
                  this may be due to a typo or recent changes to your name or legal entity, please update your
                  information.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="legal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full legal name (must match your ID)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your full legal name" {...field} />
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
                    <ComboBox {...field} options={countryOptions} placeholder="Select country" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="business_entity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of entity</FormLabel>
                  <FormControl>
                    <RadioButtons
                      value={field.value ? "business" : "individual"}
                      onChange={(value) => field.onChange(value === "business")}
                      options={[
                        { label: "Individual", value: "individual" },
                        { label: "Business", value: "business" },
                      ]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formValues.business_entity ? (
              <div className="grid auto-cols-fr grid-flow-col items-start gap-3">
                <FormField
                  control={form.control}
                  name="business_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business legal name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter business legal name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isForeign ? (
                  <>
                    <FormField
                      control={form.control}
                      name="business_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <ComboBox
                              {...field}
                              value={field.value?.toString() ?? ""}
                              onChange={(value) => field.onChange(+value)}
                              options={[
                                { label: "C corporation", value: BusinessType.CCorporation.toString() },
                                { label: "S corporation", value: BusinessType.SCorporation.toString() },
                                { label: "Partnership", value: BusinessType.Partnership.toString() },
                                { label: "LLC", value: BusinessType.LLC.toString() },
                              ]}
                              placeholder="Select business type"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {formValues.business_type === BusinessType.LLC && (
                      <FormField
                        control={form.control}
                        name="tax_classification"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax classification</FormLabel>
                            <FormControl>
                              <ComboBox
                                {...field}
                                value={field.value?.toString() ?? ""}
                                onChange={(value) => field.onChange(+value)}
                                options={[
                                  { label: "C corporation", value: TaxClassification.CCorporation.toString() },
                                  { label: "S corporation", value: TaxClassification.SCorporation.toString() },
                                  { label: "Partnership", value: TaxClassification.Partnership.toString() },
                                ]}
                                placeholder="Select tax classification"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                ) : null}
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{`Country of ${formValues.business_entity ? "incorporation" : "residence"}`}</FormLabel>
                  <FormControl>
                    <ComboBox {...field} options={countryOptions} placeholder="Select country" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid items-start gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between gap-2">
                      <FormLabel>
                        {isForeign
                          ? "Foreign tax ID"
                          : `Tax ID (${formValues.business_entity ? "EIN" : "SSN or ITIN"})`}
                      </FormLabel>
                      {!isForeign && field.value && !form.getFieldState("tax_id").isDirty ? (
                        <>
                          {taxIdStatus === "verified" && <Status variant="success">VERIFIED</Status>}
                          {taxIdStatus === "invalid" && <Status variant="critical">INVALID</Status>}
                          {!taxIdStatus && <Status variant="primary">VERIFYING</Status>}
                        </>
                      ) : null}
                    </div>
                    <div className="flex">
                      <FormControl>
                        <Input
                          type={maskTaxId ? "password" : "text"}
                          placeholder={taxIdPlaceholder}
                          autoComplete="flexile-tax-id"
                          {...field}
                          value={formatUSTaxId(field.value)}
                          onChange={(e) => field.onChange(normalizedTaxId(e.target.value))}
                          className="w-full rounded-r-none border-r-0"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-l-none"
                        onPointerDown={() => setMaskTaxId(false)}
                        onPointerUp={() => setMaskTaxId(true)}
                        onPointerLeave={() => setMaskTaxId(true)}
                      >
                        {maskTaxId ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DatePicker
                        {...field}
                        label={`Date of ${formValues.business_entity ? "incorporation" : "birth"} (optional)`}
                        granularity="day"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="street_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Residential address (street name, number, apartment)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter city" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid items-start gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{stateLabel}</FormLabel>
                    <FormControl>
                      <ComboBox
                        {...field}
                        options={countrySubdivisions.map((entry) => ({
                          value: entry.code.slice(countryCodePrefix.length),
                          label: entry.name,
                        }))}
                        disabled={!countrySubdivisions.length}
                        placeholder={`Select ${stateLabel.toLowerCase()}`}
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
                    <FormLabel>{zipCodeLabel}</FormLabel>
                    <FormControl>
                      <Input placeholder={`Enter ${zipCodeLabel.toLowerCase()}`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-8">
            <MutationStatusButton
              type="submit"
              disabled={!!isTaxInfoConfirmed && !form.formState.isDirty}
              mutation={saveMutation}
            >
              Save changes
            </MutationStatusButton>

            {user.roles.worker ? (
              <div className="flex items-center text-sm">
                Changes to your tax information may trigger{" "}
                {data.contractor_for_companies.length === 1 ? "a new contract" : "new contracts"} with{" "}
                {data.contractor_for_companies.join(", ")}.
              </div>
            ) : null}
          </div>
        </form>
      </Form>

      <LegalCertificationModal
        open={showCertificationModal}
        onClose={() => setShowCertificationModal(false)}
        legalName={formValues.legal_name}
        isForeignUser={isForeign}
        isBusiness={formValues.business_entity}
        mutation={saveMutation}
      />
    </SettingsLayout>
  );
}

const LegalCertificationModal = ({
  open,
  legalName,
  isForeignUser,
  isBusiness,
  sticky,
  onClose,
  mutation,
}: {
  open: boolean;
  legalName: string;
  isForeignUser: boolean;
  isBusiness: boolean;
  sticky?: boolean;
  onClose: () => void;
  mutation: UseMutationResult<unknown, unknown, string>;
}) => {
  const uid = useId();
  const [signature, setSignature] = useState(legalName);
  useEffect(() => setSignature(legalName), [legalName]);
  const certificateType = isForeignUser ? (isBusiness ? "W-8BEN-E" : "W-8BEN") : "W-9";
  const foreignEntityTitle = isBusiness ? "entity" : "person";
  const signMutation = useMutation({
    mutationFn: async () => {
      await mutation.mutateAsync(signature);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        if (!sticky) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{certificateType} Certification and Tax Forms Delivery</DialogTitle>
        </DialogHeader>
        {isForeignUser ? (
          <>
            <div>
              The provided information will be included in the {certificateType} form required by the U.S. tax laws to
              confirm your taxpayer status. If you're eligible for 1042-S forms, you'll receive an email with a download
              link once available.
            </div>
            <div className="flex gap-1">
              <ArrowUpRightFromSquare className="size-4" />
              <a
                target="_blank"
                rel="noopener noreferrer nofollow"
                href={`https://www.irs.gov/forms-pubs/about-form-${certificateType.toLowerCase()}`}
                className={linkClasses}
              >
                Official {certificateType} instructions
              </a>
            </div>
          </>
        ) : (
          <>
            <div>
              The information you provided will be included in the W-9 form required by the U.S. tax laws to confirm
              your taxpayer status. If you're eligible for 1099 forms, you'll receive an email with a download link once
              available.
            </div>
            <div className="flex gap-1">
              <ArrowUpRightFromSquare className="size-4" />
              <a
                target="_blank"
                rel="noopener noreferrer nofollow"
                href="https://www.irs.gov/forms-pubs/about-form-w-9"
                className={linkClasses}
              >
                Official W-9 instructions
              </a>
            </div>
          </>
        )}

        <div className="prose h-[25em] overflow-y-auto rounded-md border p-4">
          <b>{certificateType} Certification</b>
          <br />
          <br />
          {isForeignUser ? (
            <>
              Under penalties of perjury, I declare that I have examined the information on this form and to the best of
              my knowledge and belief it is true, correct, and complete. I further certify under penalties of perjury
              that:
              <br />
              <br />
              {isBusiness
                ? "• The entity identified on line 1 of this form is the beneficial owner of all the income or proceeds to which this form relates, is using this form to certify its status for chapter 4 purposes, or is submitting this form for purposes of section 6050W or 6050Y;"
                : "• I am the individual that is the beneficial owner (or am authorized to sign for the individual that is the beneficial owner) of all the income or proceeds to which this form relates or am using this form to document myself for chapter 4 purposes;"}
              <br />
              <br />• The {foreignEntityTitle} named on line 1 of this form is not a U.S. person; <br />
              <br />
              • This form relates to:
              <br />
              <br />
              (a) income not effectively connected with the conduct of a trade or business in the United States;
              <br />
              (b) income effectively connected with the conduct of a trade or business in the United States but is not
              subject to tax under an applicable income tax treaty;
              <br />
              (c) the partner's share of a partnership's effectively connected taxable income; or
              <br />
              (d) the partner's amount realized from the transfer of a partnership interest subject to withholding under
              section 1446(f);
              <br />
              <br />• The {foreignEntityTitle} named on line 1 of this form is a resident of the treaty Country of
              residence listed on line 9 of the form (if any) within the meaning of the income tax treaty between the
              United States and that Country of residence; and <br />
              <br />
              • For broker transactions or barter exchanges, the beneficial owner is an exempt foreign person as defined
              in the instructions.
              <br />
              <br />
              Furthermore, I authorize this form to be provided to any withholding agent that has control, receipt, or
              custody of the income of which the {foreignEntityTitle} named on line 1 or any withholding agent that can
              disburse or make payments of the income of which the {foreignEntityTitle} named on line 1. <br />
              <br />I agree that I will submit a new form within 30 days if any certification made on this form becomes
              incorrect.
            </>
          ) : (
            <>
              Under penalties of perjury, I certify that:
              <br />
              <br />
              <ol>
                <li>
                  The number shown on this form is my correct taxpayer identification number (or I am waiting for a
                  number to be issued to me); and
                </li>
                <li>
                  I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have
                  not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a
                  result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no
                  longer subject to backup withholding; and
                </li>
                <li>I am a U.S. citizen or other U.S. person (defined below); and</li>
                <li>
                  The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is
                  correct
                </li>
              </ol>
            </>
          )}
          <br />
          <br />
          <b>Consent for Electronic Delivery of Tax Forms</b>
          <br />
          <br />
          By consenting to receive tax forms electronically, you agree to the following terms:
          <br />
          <br />
          <ol>
            <li>Your consent applies to all tax documents during your time using Flexile services.</li>
            <li>
              You can withdraw this consent or request paper copies anytime by contacting{" "}
              <a href="mailto:support@flexile.com" className={linkClasses}>
                support@flexile.com
              </a>
              .
            </li>
            <li>
              To access your tax forms, you'll need internet, an email account, your Flexile password, and PDF-viewing
              software.
            </li>
            <li>Your tax forms will be available for download for at least one year.</li>
            <li>
              If you don't consent to electronic delivery, contact us at{" "}
              <a href="mailto:support@flexile.com" className={linkClasses}>
                support@flexile.com
              </a>{" "}
              to arrange postal delivery.
            </li>
          </ol>
        </div>

        <Label htmlFor={uid}>Your signature</Label>
        <Input
          id={uid}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          className="font-signature text-xl"
          aria-label="Signature"
        />
        <p className="text-muted-foreground text-sm">
          I agree that the signature will be the electronic representation of my signature and for all purposes when I
          use them on documents just the same as a pen-and-paper signature.
        </p>

        <DialogFooter>
          <MutationButton mutation={signMutation} loadingText="Saving..." disabled={!signature}>
            Save
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
