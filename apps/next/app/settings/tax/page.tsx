"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Map } from "immutable";
import { iso31662 } from "iso-3166";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import LegalCertificationModal from "@/app/onboarding/LegalCertificationModal";
import Button from "@/components/Button";
import { CardRow } from "@/components/Card";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import RadioButtons from "@/components/RadioButtons";
import Select from "@/components/Select";
import Status from "@/components/Status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BusinessType, TaxClassification } from "@/db/enums";
import { useCurrentUser } from "@/global";
import { countries } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { getTinName } from "@/utils/legal";
import { request } from "@/utils/request";
import { settings_tax_path } from "@/utils/routes";
import { useOnChange } from "@/utils/useOnChange";
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

export default function TaxPage() {
  const user = useCurrentUser();

  const { data } = useSuspenseQuery({
    queryKey: ["settings-tax"],
    queryFn: async () => {
      const response = await request({ accept: "json", method: "GET", url: settings_tax_path(), assertOk: true });
      return dataSchema.parse(await response.json());
    },
  });
  const [formData, setFormData] = useState(data);
  const [errors, setErrors] = useState(Map<string, string>());
  const countryCodePrefix = `${formData.country_code}-`;
  const countrySubdivisions = iso31662.filter((entry) => entry.code.startsWith(countryCodePrefix));

  const [taxInfoChanged, setTaxInfoChanged] = useState(false);
  const [isTaxInfoConfirmed, setIsTaxInfoConfirmed] = useState(false);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [taxIdChanged, setTaxIdChanged] = useState(false);
  const [taxIdStatus, setTaxIdStatus] = useState<Data["tax_id_status"]>(null);
  const [maskTaxId, setMaskTaxId] = useState(true);
  Object.entries(formData).forEach(([key, value]) =>
    useOnChange(() => {
      setTaxInfoChanged(true);
      setErrors(errors.delete(key));
    }, [value]),
  );

  useEffect(() => {
    setFormData(data);
    setIsTaxInfoConfirmed(data.is_tax_information_confirmed);
    setTaxIdStatus(data.tax_id_status);
  }, [data]);

  const isForeign = useMemo(
    () => formData.citizenship_country_code !== "US" && formData.country_code !== "US",
    [formData.citizenship_country_code, formData.country_code],
  );

  const tinName = getTinName(formData.business_entity);
  const taxIdPlaceholder = !isForeign ? (formData.business_entity ? "XX-XXXXXXX" : "XXX-XX-XXXX") : undefined;
  const zipCodeLabel = formData.country_code === "US" ? "ZIP code" : "Postal code";
  const stateLabel = formData.country_code === "US" ? "State" : "Province";
  const countryOptions = [...countries].map(([value, label]) => ({ value, label }));

  const normalizedTaxId = (taxId: string | null) => {
    if (!taxId) return null;
    if (isForeign) return taxId.toUpperCase().replace(/[^A-Z0-9]/gu, "");
    return taxId.replace(/[^0-9]/gu, "");
  };

  const formatUSTaxId = (value: string) => {
    if (isForeign) return value;

    const digits = value.replace(/\D/gu, "");
    if (formData.business_entity) {
      return digits.replace(/^(\d{2})(\d{0,7})/u, (_, p1: string, p2: string) => (p2 ? `${p1}-${p2}` : p1));
    }
    return digits.replace(/^(\d{3})(\d{0,2})(\d{0,4})/u, (_, p1: string, p2: string, p3: string) => {
      if (p3) return `${p1}-${p2}-${p3}`;
      if (p2) return `${p1}-${p2}`;
      return p1;
    });
  };

  const handleSave = () => {
    const newErrors = errors.clear().withMutations((errors) => {
      if (!formData.tax_id) errors.set("tax_id", `Please add your ${isForeign ? "foreign tax ID" : tinName}.`);
      else if (!isForeign) {
        if (formData.tax_id.length !== 9) errors.set("tax_id", `Please check that your ${tinName} is 9 numbers long.`);
        else if (/^(\d)\1{8}$/u.test(formData.tax_id))
          errors.set("tax_id", `Your ${tinName} can't have all identical digits.`);
      }

      const labels = {
        street_address: "residential address",
        city: "city or town",
        zip_code: zipCodeLabel.toLowerCase(),
      };
      for (const field of ["street_address", "city", "zip_code"] as const) {
        if (!formData[field]) errors.set(field, `Please add your ${labels[field]}.`);
      }

      if (!formData.state && countrySubdivisions.length > 0)
        errors.set("state", `Please select a ${stateLabel.toLowerCase()}.`);
      if (formData.business_entity && !formData.business_name) {
        errors.set("business_name", "Please add your business legal name.");
      }

      if (!/\S+\s+\S+/u.test(formData.legal_name)) {
        errors.set("legal_name", "This doesn't look like a complete full name.");
      }

      // Only validate US ZIP code format for US addresses
      if (formData.country_code === "US" && !/(^\d{5}|\d{9}|\d{5}[- ]\d{4})$/u.test(formData.zip_code)) {
        errors.set("zip_code", "Please add a valid ZIP code (5 or 9 digits).");
      } else if (formData.country_code !== "US" && !/\d/u.test(formData.zip_code)) {
        errors.set("zip_code", "Please add a valid postal code (must contain at least one number).");
      }

      if (formData.business_entity && formData.business_type === null) {
        errors.set("business_type", "Please select a business type.");
      }

      if (formData.business_type === BusinessType.LLC && formData.tax_classification === null) {
        errors.set("tax_classification", "Please select a tax classification.");
      }
    });
    setErrors(newErrors);
    if (newErrors.size === 0) setShowCertificationModal(true);
  };

  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const updateTaxSettings = trpc.users.updateTaxSettings.useMutation();
  const saveMutation = useMutation({
    mutationFn: async (signature: string) => {
      const data = await updateTaxSettings.mutateAsync({
        data: { ...formData, tax_id: normalizedTaxId(formData.tax_id), signature },
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
      <FormSection
        title="Tax information"
        description={`These details will be included in your ${
          user.roles.worker ? "invoices and " : ""
        }applicable tax forms.`}
      >
        <CardRow className="grid gap-4">
          {!isTaxInfoConfirmed && (
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertDescription>
                Confirm your tax information to avoid delays on your payments or additional tax withholding.
              </AlertDescription>
            </Alert>
          )}

          {formData.tax_id_status === "invalid" && (
            <Alert>
              <InformationCircleIcon />
              <AlertTitle>Review your tax information</AlertTitle>
              <AlertDescription>
                Since there's a mismatch between the legal name and {tinName} you provided and your government records,
                please note that your payments could experience a tax withholding rate of 24%. If you think this may be
                due to a typo or recent changes to your name or legal entity, please update your information.
              </AlertDescription>
            </Alert>
          )}

          <Input
            value={formData.legal_name}
            onChange={(value) => setFormData({ ...formData, legal_name: value })}
            label="Full legal name (must match your ID)"
            placeholder="Enter your full legal name"
            invalid={errors.has("legal_name")}
            help={errors.get("legal_name")}
          />

          <Select
            value={formData.citizenship_country_code}
            onChange={(value) => setFormData({ ...formData, citizenship_country_code: value })}
            options={countryOptions}
            label="Country of citizenship"
          />

          <RadioButtons
            value={formData.business_entity ? "business" : "individual"}
            onChange={(value) => setFormData({ ...formData, business_entity: value === "business" })}
            label="Type of entity"
            options={[
              { label: "Individual", value: "individual" },
              { label: "Business", value: "business" },
            ]}
          />

          {formData.business_entity ? (
            <div className="grid auto-cols-fr grid-flow-col items-start gap-3">
              <Input
                value={formData.business_name ?? ""}
                onChange={(value) => setFormData({ ...formData, business_name: value })}
                label="Business legal name"
                placeholder="Enter business legal name"
                invalid={errors.has("business_name")}
                help={errors.get("business_name")}
              />

              {!isForeign ? (
                <>
                  <Select
                    value={formData.business_type?.toString() ?? ""}
                    onChange={(value) => setFormData({ ...formData, business_type: +value })}
                    options={[
                      { label: "C corporation", value: BusinessType.CCorporation.toString() },
                      { label: "S corporation", value: BusinessType.SCorporation.toString() },
                      { label: "Partnership", value: BusinessType.Partnership.toString() },
                      { label: "LLC", value: BusinessType.LLC.toString() },
                    ]}
                    label="Type"
                    placeholder="Select business type"
                    invalid={errors.has("business_type")}
                    help={errors.get("business_type")}
                  />

                  {formData.business_type === BusinessType.LLC && (
                    <Select
                      value={formData.tax_classification?.toString() || ""}
                      onChange={(value) => setFormData({ ...formData, tax_classification: +value })}
                      options={[
                        { label: "C corporation", value: TaxClassification.CCorporation.toString() },
                        { label: "S corporation", value: TaxClassification.SCorporation.toString() },
                        { label: "Partnership", value: TaxClassification.Partnership.toString() },
                      ]}
                      label="Tax classification"
                      placeholder="Select tax classification"
                      invalid={errors.has("tax_classification")}
                      help={errors.get("tax_classification")}
                    />
                  )}
                </>
              ) : null}
            </div>
          ) : null}

          <Select
            value={formData.country_code}
            onChange={(value) => setFormData({ ...formData, country_code: value })}
            options={countryOptions}
            label={`Country of ${formData.business_entity ? "incorporation" : "residence"}`}
          />

          <div className="grid items-start gap-3 md:grid-cols-2">
            <Input
              value={formatUSTaxId(formData.tax_id ?? "")}
              type={maskTaxId ? "password" : "text"}
              onChange={(value) => {
                setFormData({ ...formData, tax_id: normalizedTaxId(value) });
                setTaxIdChanged(true);
              }}
              suffix={
                <Button
                  variant="link"
                  onPointerDown={() => setMaskTaxId(false)}
                  onPointerUp={() => setMaskTaxId(true)}
                  onPointerLeave={() => setMaskTaxId(true)}
                  onTouchStart={() => setMaskTaxId(false)}
                  onTouchEnd={() => setMaskTaxId(true)}
                  onTouchCancel={() => setMaskTaxId(true)}
                >
                  {maskTaxId ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              }
              label={
                <div className="flex justify-between gap-2">
                  {useMemo(() => (isForeign ? "Foreign tax ID" : `Tax ID (${tinName})`), [isForeign, tinName])}
                  {!isForeign && formData.tax_id && !taxIdChanged ? (
                    <>
                      {taxIdStatus === "verified" && <Status variant="success">VERIFIED</Status>}
                      {taxIdStatus === "invalid" && <Status variant="critical">INVALID</Status>}
                      {!taxIdStatus && <Status variant="primary">VERIFYING</Status>}
                    </>
                  ) : null}
                </div>
              }
              placeholder={taxIdPlaceholder}
              invalid={errors.has("tax_id")}
              help={errors.get("tax_id")}
              autoComplete="flexile-tax-id"
            />

            <Input
              value={formData.birth_date ?? ""}
              onChange={(value) => setFormData({ ...formData, birth_date: value })}
              label={`Date of ${formData.business_entity ? "incorporation" : "birth"} (optional)`}
              type="date"
            />
          </div>

          <Input
            value={formData.street_address}
            onChange={(value) => setFormData({ ...formData, street_address: value })}
            label="Residential address (street name, number, apartment)"
            placeholder="Enter address"
            invalid={errors.has("street_address")}
            help={errors.get("street_address")}
          />

          <Input
            value={formData.city}
            onChange={(value) => setFormData({ ...formData, city: value })}
            label="City"
            placeholder="Enter city"
            invalid={errors.has("city")}
            help={errors.get("city")}
          />

          <div className="grid items-start gap-3 md:grid-cols-2">
            <Select
              value={formData.state}
              onChange={(value) => setFormData({ ...formData, state: value })}
              options={countrySubdivisions.map((entry) => ({
                value: entry.code.slice(countryCodePrefix.length),
                label: entry.name,
              }))}
              label={stateLabel}
              invalid={errors.has("state")}
              disabled={!countrySubdivisions.length}
              help={errors.get("state")}
            />

            <Input
              value={formData.zip_code}
              onChange={(value) => setFormData({ ...formData, zip_code: value })}
              label={zipCodeLabel}
              placeholder={`Enter ${zipCodeLabel.toLowerCase()}`}
              invalid={errors.has("zip_code")}
              help={errors.get("zip_code")}
            />
          </div>
        </CardRow>

        <CardRow className="flex flex-wrap items-center gap-4">
          <Button disabled={!taxInfoChanged && isTaxInfoConfirmed} onClick={handleSave}>
            Save changes
          </Button>

          {user.roles.worker ? (
            <div>
              Changes to your tax information may trigger{" "}
              {formData.contractor_for_companies.length === 1 ? "a new contract" : "new contracts"} with{" "}
              {formData.contractor_for_companies.join(", ")}
            </div>
          ) : null}
        </CardRow>
      </FormSection>

      <LegalCertificationModal
        open={showCertificationModal}
        onClose={() => setShowCertificationModal(false)}
        legalName={formData.legal_name}
        isForeignUser={isForeign}
        isBusiness={formData.business_entity}
        mutation={saveMutation}
      />
    </SettingsLayout>
  );
}
