"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { iso31662 } from "iso-3166";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import LegalCertificationModal from "@/app/onboarding/LegalCertificationModal";
import ComboBox from "@/components/ComboBox";
import FormSection from "@/components/FormSection";
import RadioButtons from "@/components/RadioButtons";
import Status from "@/components/Status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BusinessType, TaxClassification } from "@/db/enums";
import { useCurrentUser } from "@/global";
import { countries } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { getTinName } from "@/utils/legal";
import { request } from "@/utils/request";
import { settings_tax_path } from "@/utils/routes";
import SettingsLayout from "../Layout";

const dataSchema = z.object({
  birth_date: z.string().nullable(),
  business_name: z.string().nullable(),
  business_type: z.number().nullable(),
  tax_classification: z.number().nullable(),
  citizenship_country_code: z.string(),
  city: z.string(),
  country_code: z.string(),
  display_name: z.string(),
  business_entity: z.boolean(),
  is_foreign: z.boolean(),
  is_tax_information_confirmed: z.boolean(),
  legal_name: z.string(),
  signature: z.string(),
  state: z.string(),
  street_address: z.string(),
  tax_id: z.string().nullable(),
  tax_id_status: z.enum(["verified", "invalid"]).nullable(),
  zip_code: z.string(),
  contractor_for_companies: z.array(z.string()),
});
type Data = z.infer<typeof dataSchema>;

const formSchema = z
  .object({
    legal_name: z
      .string()
      .min(1, "Please add your full legal name.")
      .refine((value) => /\S+\s+\S+/u.test(value), {
        message: "This doesn't look like a complete full name.",
      }),
    citizenship_country_code: z.string(),
    business_entity: z.boolean(),
    business_name: z.string().nullable(),
    business_type: z.number().nullable(),
    tax_classification: z.number().nullable(),
    country_code: z.string(),
    tax_id: z.string().nullable(),
    birth_date: z.string().nullable(),
    street_address: z.string().min(1, "Please add your residential address."),
    city: z.string().min(1, "Please add your city or town."),
    state: z.string(),
    zip_code: z.string().min(1, "Please add your postal code."),
  })
  .superRefine((data, ctx) => {
    const isForeign = data.citizenship_country_code !== "US" && data.country_code !== "US";
    const tinName = getTinName(data.business_entity);

    if (!data.tax_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Please add your ${isForeign ? "foreign tax ID" : tinName}.`,
        path: ["tax_id"],
      });
    } else if (!isForeign) {
      if (data.tax_id.length !== 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Please check that your ${tinName} is 9 numbers long.`,
          path: ["tax_id"],
        });
      } else if (/^(\d)\1{8}$/u.test(data.tax_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Your ${tinName} can't have all identical digits.`,
          path: ["tax_id"],
        });
      }
    }

    if (data.business_entity && !data.business_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please add your business legal name.",
        path: ["business_name"],
      });
    }

    if (data.business_entity && data.business_type === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a business type.",
        path: ["business_type"],
      });
    }

    if (data.business_entity && data.business_type === BusinessType.LLC && data.tax_classification === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a tax classification.",
        path: ["tax_classification"],
      });
    }

    if (data.country_code === "US" && !/(^\d{5}|\d{9}|\d{5}[- ]\d{4})$/u.test(data.zip_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please add a valid ZIP code (5 or 9 digits).",
        path: ["zip_code"],
      });
    } else if (data.country_code !== "US" && !/\d/u.test(data.zip_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please add a valid postal code (must contain at least one number).",
        path: ["zip_code"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export default function TaxPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const updateTaxSettings = trpc.users.updateTaxSettings.useMutation();

  const { data } = useSuspenseQuery({
    queryKey: ["settings-tax"],
    queryFn: async () => {
      const response = await request({ accept: "json", method: "GET", url: settings_tax_path(), assertOk: true });
      return dataSchema.parse(await response.json());
    },
  });

  const [taxInfoChanged, setTaxInfoChanged] = useState(false);
  const [isTaxInfoConfirmed, setIsTaxInfoConfirmed] = useState(data.is_tax_information_confirmed);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [taxIdChanged, setTaxIdChanged] = useState(false);
  const [taxIdStatus, setTaxIdStatus] = useState<Data["tax_id_status"]>(data.tax_id_status);
  const [maskTaxId, setMaskTaxId] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legal_name: data.legal_name,
      citizenship_country_code: data.citizenship_country_code,
      business_entity: data.business_entity,
      business_name: data.business_name,
      business_type: data.business_type,
      tax_classification: data.tax_classification,
      country_code: data.country_code,
      tax_id: data.tax_id,
      birth_date: data.birth_date,
      street_address: data.street_address,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
    },
  });

  const formValues = form.watch();
  const isForeign = useMemo(
    () => formValues.citizenship_country_code !== "US" && formValues.country_code !== "US",
    [formValues.citizenship_country_code, formValues.country_code],
  );

  useEffect(() => {
    setTaxInfoChanged(true);
  }, [formValues]);

  const countryCodePrefix = `${formValues.country_code}-`;
  const countrySubdivisions = iso31662.filter((entry) => entry.code.startsWith(countryCodePrefix));

  const tinName = getTinName(formValues.business_entity);
  const taxIdPlaceholder = !isForeign ? (formValues.business_entity ? "XX-XXXXXXX" : "XXX-XX-XXXX") : undefined;
  const zipCodeLabel = formValues.country_code === "US" ? "ZIP code" : "Postal code";
  const stateLabel = formValues.country_code === "US" ? "State" : "Province";
  const countryOptions = [...countries].map(([value, label]) => ({ value, label }));

  const normalizedTaxId = (taxId: string | null) => {
    if (!taxId) return null;
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

  const onSubmit = () => {
    setShowCertificationModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (signature: string) => {
      const formData = form.getValues();

      const data = await updateTaxSettings.mutateAsync({
        data: {
          ...formData,
          tax_id: normalizedTaxId(formData.tax_id),
          signature,
          is_tax_information_confirmed: true,
        },
      });

      setIsTaxInfoConfirmed(true);
      setTaxInfoChanged(false);
      if (taxIdChanged) setTaxIdStatus(null);
      setTaxIdChanged(false);
      setShowCertificationModal(false);
      if (data.documentId) {
        await trpcUtils.documents.list.invalidate();
        router.push(`/documents?sign=${data.documentId}`);
      }
    },
  });

  return (
    <SettingsLayout>
      <Form {...form}>
        <FormSection
          title="Tax information"
          description={`These details will be included in your ${
            user.roles.worker ? "invoices and " : ""
          }applicable tax forms.`}
        >
          <CardContent className="grid gap-4">
            {!isTaxInfoConfirmed && (
              <Alert variant="destructive">
                <ExclamationTriangleIcon />
                <AlertDescription>
                  Confirm your tax information to avoid delays on your payments or additional tax withholding.
                </AlertDescription>
              </Alert>
            )}

            {taxIdStatus === "invalid" && (
              <Alert>
                <InformationCircleIcon />
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
                    <ComboBox options={countryOptions} {...field} />
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
                        <Input placeholder="Enter business legal name" {...field} value={field.value ?? ""} />
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
                              options={[
                                { label: "C corporation", value: BusinessType.CCorporation.toString() },
                                { label: "S corporation", value: BusinessType.SCorporation.toString() },
                                { label: "Partnership", value: BusinessType.Partnership.toString() },
                                { label: "LLC", value: BusinessType.LLC.toString() },
                              ]}
                              value={field.value?.toString() ?? ""}
                              onChange={(value) => field.onChange(+value)}
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
                                options={[
                                  { label: "C corporation", value: TaxClassification.CCorporation.toString() },
                                  { label: "S corporation", value: TaxClassification.SCorporation.toString() },
                                  { label: "Partnership", value: TaxClassification.Partnership.toString() },
                                ]}
                                value={field.value?.toString() ?? ""}
                                onChange={(value) => field.onChange(+value)}
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
                    <ComboBox options={countryOptions} {...field} />
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
                    <FormLabel>
                      <div className="flex justify-between gap-2">
                        {isForeign ? "Foreign tax ID" : `Tax ID (${formValues.business_entity ? "EIN" : "SSN or ITIN"})`}
                        {!isForeign && field.value && !taxIdChanged ? (
                          <>
                            {taxIdStatus === "verified" && <Status variant="success">VERIFIED</Status>}
                            {taxIdStatus === "invalid" && <Status variant="critical">INVALID</Status>}
                            {!taxIdStatus && <Status variant="primary">VERIFYING</Status>}
                          </>
                        ) : null}
                      </div>
                    </FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Input
                          type={maskTaxId ? "password" : "text"}
                          placeholder={taxIdPlaceholder}
                          autoComplete="flexile-tax-id"
                          {...field}
                          value={formatUSTaxId(field.value ?? "")}
                          onChange={(e) => {
                            field.onChange(normalizedTaxId(e.target.value));
                            setTaxIdChanged(true);
                          }}
                          className="rounded-r-none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-l-none"
                          onPointerDown={() => setMaskTaxId(false)}
                          onPointerUp={() => setMaskTaxId(true)}
                          onPointerLeave={() => setMaskTaxId(true)}
                          onTouchStart={() => setMaskTaxId(false)}
                          onTouchEnd={() => setMaskTaxId(true)}
                          onTouchCancel={() => setMaskTaxId(true)}
                        >
                          {maskTaxId ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{`Date of ${formValues.business_entity ? "incorporation" : "birth"} (optional)`}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
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
                        options={countrySubdivisions.map((entry) => ({
                          value: entry.code.slice(countryCodePrefix.length),
                          label: entry.name,
                        }))}
                        {...field}
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
          </CardContent>

          <CardFooter className="flex-wrap gap-4">
            <Button
              type="button"
              disabled={!taxInfoChanged && isTaxInfoConfirmed}
              onClick={() => {
                void form.handleSubmit(onSubmit)();
              }}
            >
              Save changes
            </Button>

            {user.roles.worker ? (
              <div>
                Changes to your tax information may trigger{" "}
                {data.contractor_for_companies.length === 1 ? "a new contract" : "new contracts"} with{" "}
                {data.contractor_for_companies.join(", ")}
              </div>
            ) : null}
          </CardFooter>
        </FormSection>
      </Form>

      <LegalCertificationModal
        open={showCertificationModal}
        onClose={() => setShowCertificationModal(false)}
        legalName={form.getValues().legal_name}
        isForeignUser={isForeign}
        isBusiness={form.getValues().business_entity}
        mutation={saveMutation}
      />
    </SettingsLayout>
  );
}
