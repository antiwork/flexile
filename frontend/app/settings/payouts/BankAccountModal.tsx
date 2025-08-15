import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Map as ImmutableMap } from "immutable";
import { set } from "lodash-es";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import MutationButton from "@/components/MutationButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CURRENCIES,
  type Currency,
  currencyByCountryCode,
  currencyCodes,
  supportedCountries,
} from "@/models/constants";
import { cn } from "@/utils";
import { request } from "@/utils/request";
import { settings_bank_accounts_path, wise_account_requirements_path } from "@/utils/routes";

const KEY_LEGAL_TYPE = "legalType";
const KEY_CHECKING_ACCOUNT = "CHECKING";
const KEY_ACCOUNT_TYPE = "accountType";
const KEY_ACCOUNT_HOLDER_NAME = "accountHolderName";
const KEY_ACCOUNT_ROUTING_NUMBER = "abartn";
const KEY_ADDRESS_COUNTRY = "address.country";
const KEY_ADDRESS_STATE = "address.state";
const KEY_ADDRESS_CITY = "address.city";
const KEY_ADDRESS_POST_CODE = "address.postCode";
const KEY_ADDRESS_FIRST_LINE = "address.firstLine";
const KEY_SWIFT_CODE = "swiftCode";
const SWIFT_BANK_ACCOUNT_TYPE = "swift_code";
const LOCAL_BANK_ACCOUNT_TITLE = "Local bank account";

const inputFieldSchema = z.object({
  type: z.enum(["text", "date"]),
  name: z.string(),
  minLength: z.number().nullable(),
  maxLength: z.number().nullable(),
  displayFormat: z.string().nullable(),
  validationRegexp: z.string().nullable(),
  validationAsync: z
    .object({
      url: z.string(),
      params: z.array(z.object({ key: z.string(), parameterName: z.string(), required: z.boolean() })),
    })
    .nullable(),
  example: z.string(),
});
type InputField = z.infer<typeof inputFieldSchema>;

const fieldSchema = z
  .object({ key: z.string(), refreshRequirementsOnChange: z.boolean(), required: z.boolean(), name: z.string() })
  .and(
    inputFieldSchema.or(
      z.intersection(
        // for some reason, z.enum(["select", "radio"]) doesn't work here
        z.object({ type: z.literal("select") }).or(z.object({ type: z.literal("radio") })),
        z.object({
          valuesAllowed: z.array(z.object({ key: z.string(), name: z.string() })).nullable(),
        }),
      ),
    ),
  );
type Field = z.infer<typeof fieldSchema>;

const formSchema = z.object({
  type: z.string(),
  title: z.string(),
  fields: z.array(z.object({ name: z.string(), group: z.array(fieldSchema) })),
});

type Form = z.infer<typeof formSchema>;
type BillingDetails = {
  country: string | null;
  country_code: string | null;
  state: string | null;
  city: string | null;
  zip_code: string | null;
  street_address: string | null;
  email: string;
  billing_entity_name: string;
  legal_type: "BUSINESS" | "PRIVATE";
};

export const bankAccountSchema = z.object({
  id: z.number(),
  currency: z.enum(currencyCodes),
  details: z.record(z.string(), z.union([z.string(), z.null()])),
  last_four_digits: z.string(),
  used_for_dividends: z.boolean(),
  used_for_invoices: z.boolean(),
});
export type BankAccount = z.infer<typeof bankAccountSchema>;

interface Props {
  open: boolean;
  billingDetails: BillingDetails;
  bankAccount?: BankAccount;
  onComplete: (value: BankAccount) => void;
  onClose: () => void;
}

const countryOptions = Array.from(supportedCountries).map(([countryCode, name]) => ({ name, key: countryCode }));

const validateCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/gu, "");

  if (digits.length !== 11) return false;

  if (/^(\d)\1{10}$/u.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let remainder = sum % 11;
  const firstCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(digits.charAt(9), 10) !== firstCheckDigit) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  remainder = sum % 11;
  const secondCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(digits.charAt(10), 10) === secondCheckDigit;
};

const fieldGroups: string[][] = [
  [
    "ifscCode",
    "sortCode",
    "institutionNumber",
    "transitNumber",
    "branchCode",
    KEY_SWIFT_CODE,
    KEY_ACCOUNT_ROUTING_NUMBER,
    "accountNumber",
  ],
  [KEY_ADDRESS_CITY, KEY_ADDRESS_STATE, KEY_ADDRESS_POST_CODE],
];

const BankAccountModal = ({ open, billingDetails, bankAccount, onComplete, onClose }: Props) => {
  const defaultCurrency =
    bankAccount?.currency ??
    (billingDetails.country_code ? currencyByCountryCode.get(billingDetails.country_code) : undefined) ??
    "USD";
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  useEffect(() => setCurrency(defaultCurrency), [defaultCurrency]);

  const [selectedFormIndex, setSelectedFormIndex] = useState(0);
  const [details, setDetails] = useState(ImmutableMap(bankAccount?.details ?? {}));
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const [errors, setErrors] = useState(new Map<string, string>());
  const previousForms = useRef<Form[] | null>(null);
  const uid = useId();

  const nestedDetails = () => {
    const result = {};
    const values =
      previousForms.current?.[selectedFormIndex]?.fields.flatMap((field) =>
        field.group.map((field) => [field.key, detailsRef.current.get(field.key)] as const),
      ) ?? detailsRef.current.entries();
    for (const [k, v] of Array.from(values)) {
      if (v) set(result, k, v.trim());
    }
    return result;
  };

  const {
    data: forms,
    refetch,
    isPending,
  } = useSuspenseQuery({
    queryKey: ["wise-account-requirements", currency],
    queryFn: async ({ signal }) => {
      const response = await request({
        method: "POST",
        url: wise_account_requirements_path(),
        accept: "json",
        jsonData: {
          type: previousForms.current?.[selectedFormIndex]?.type,
          details: nestedDetails(),
          target: currency,
          source: "USD",
          source_amount: 50000,
        },
        signal,
      });

      return z
        .array(formSchema)
        .parse(await response.json())
        .filter((form) =>
          form.fields.some(({ group }) =>
            group.some(
              (field) =>
                (field.type === "select" || field.type === "radio") &&
                field.key === KEY_LEGAL_TYPE &&
                field.valuesAllowed?.some(({ key }) => key === billingDetails.legal_type),
            ),
          ),
        );
    },
  });
  previousForms.current = forms;

  const userCountry = details.get(KEY_ADDRESS_COUNTRY) || billingDetails.country_code || "US";

  const defaultFormIndex = useMemo(() => {
    const index = forms.findIndex((form) => {
      if (currency === "USD" && userCountry === "US") {
        return form.title === LOCAL_BANK_ACCOUNT_TITLE;
      } else if (currency === "USD") {
        return form.type === SWIFT_BANK_ACCOUNT_TYPE;
      }
      return form.title === LOCAL_BANK_ACCOUNT_TITLE || form.type === "iban";
    });
    return !index || index < 0 ? 0 : index;
  }, [forms, currency, userCountry]);

  const formSwitch = useMemo(() => {
    if (forms.length !== 2) return undefined;
    const otherForm = forms[(defaultFormIndex + 1) % 2];
    if (!otherForm) return undefined;

    const label =
      currency === "USD"
        ? "My bank account is in the US"
        : `I'd prefer to use ${otherForm.type === SWIFT_BANK_ACCOUNT_TYPE ? "SWIFT" : otherForm.title}`;

    return { label, defaultOn: currency === "USD" && userCountry === "US" };
  }, [forms, defaultFormIndex, currency, userCountry]);

  const form = forms[selectedFormIndex];
  const allFields = form?.fields.flatMap((field) => field.group);

  const visibleFields = useMemo(
    () =>
      allFields
        ?.filter(
          (field) =>
            (field.required || field.key === KEY_ADDRESS_STATE) &&
            !((field.type === "select" || field.type === "radio") && !field.valuesAllowed) &&
            field.key !== KEY_LEGAL_TYPE,
        )
        .map((field) => {
          switch (field.key) {
            case KEY_ADDRESS_STATE:
              return { ...field, name: field.required ? field.name : `${field.name} (optional)` };
            case "address.firstLine":
              return { ...field, name: "Street address, apt number" };
            case KEY_ADDRESS_COUNTRY:
              return { ...field, valuesAllowed: countryOptions };
            case KEY_ADDRESS_POST_CODE:
              return {
                ...field,
                name: field.name
                  .split(" ")
                  .map((part, i) => (i === 0 ? part : part.toLowerCase()))
                  .join(" "),
              };
            default:
              return field;
          }
        }),
    [allFields],
  );

  const hasVisibleErrors = visibleFields?.some((field) => errors.has(field.key));

  const hasRequiredFieldsEmpty = visibleFields?.some((field) => field.required && !details.get(field.key)?.trim());

  const validateField = async (field: Field) => {
    const value = details.get(field.key)?.trim() ?? "";
    if (!field.required && !value) return null;
    if (field.required && !value) return "";
    if (field.type === "select" || field.type === "radio") {
      return field.valuesAllowed?.some((option) => option.key === value) ? null : "";
    }

    if (field.key === "cpf") {
      if (!validateCPF(value)) {
        return "This CPF number looks invalid";
      }
    }

    if (field.minLength && value.length < field.minLength) {
      return `This must be at least ${field.minLength} characters long.`;
    }

    // eslint-disable-next-line require-unicode-regexp -- some of Wise's regular expressions are invalid :)
    if (field.validationRegexp && !new RegExp(field.validationRegexp).test(value)) {
      return `This doesn't look like a valid ${field.name}.`;
    }

    if (field.validationAsync) {
      const param = field.validationAsync.params.find((param) => param.key === field.key);
      if (!param) return null;
      const url = `${field.validationAsync.url}?${param.parameterName}=${value}`;

      return request({
        method: "GET",
        url,
        accept: "json",
        headers: { "Accept-Language": "en-US,en;q=0.5" },
      })
        .then((response) => (response.ok ? null : `This doesn't look like a valid ${field.name}.`))
        .catch(() => null);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!allFields) return;
      setErrors(new Map());

      const newErrors = new Map<string, string>();
      await Promise.all(
        allFields.map((field) =>
          validateField(field).then((value) => {
            if (value != null) newErrors.set(field.key, value);
          }),
        ),
      );
      try {
        if (!form) return;
        const response = await request({
          method: "POST",
          url: settings_bank_accounts_path(),
          accept: "json",
          jsonData: {
            recipient: {
              currency,
              type: form.type,
              details: nestedDetails(),
            },
            replace_recipient_id: bankAccount?.id,
          },
        });

        const saveBankAccountSchema = z.discriminatedUnion("success", [
          z.object({ success: z.literal(true), bank_account: bankAccountSchema }),
          z.object({
            success: z.literal(false),
            form_errors: z.array(z.object({ message: z.string(), path: z.string() })),
            error: z.string().nullable(),
          }),
        ]);
        const data = saveBankAccountSchema.parse(await response.json());
        if (data.success) {
          onComplete(data.bank_account);
          return;
        }

        const improvedErrorMessages: Record<string, Record<string, string>> = {
          [KEY_ACCOUNT_HOLDER_NAME]: {
            "Please enter the recipients first and last name.": "This doesn't look like a full legal name.",
          },
          [KEY_SWIFT_CODE]: {
            "It looks like the bank you are sending to is in the EU. If this is the case, we advise you to use the Inside Europe tab as this is cheaper and faster.":
              "It looks like the bank you are sending to is in the EU. If this is the case, we advise you to disable the SWIFT option as this is cheaper and faster.",
          },
          [KEY_ACCOUNT_ROUTING_NUMBER]: {
            "Unknown routing number. Please check the number and try again.":
              "This doesn't look like a valid ACH routing number.",
          },
        };

        for (const error of data.form_errors) {
          newErrors.set(error.path, improvedErrorMessages[error.path]?.[error.message] ?? error.message);
        }
      } finally {
        setErrors(newErrors);
      }
    },
  });

  const fieldUpdated = (field: Field) => {
    if (field.refreshRequirementsOnChange) {
      void refetch();
    }
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(field.key);
      return next;
    });
  };

  const groupedFields = useMemo(
    () =>
      Object.groupBy(visibleFields ?? [], (field: Field, i) => {
        const index = fieldGroups.findIndex((group) => group.includes(field.key));
        return index === -1 ? `field${i}` : `group${index}`;
      }),
    [visibleFields],
  );

  useEffect(() => {
    if (!allFields) return;

    const fields = new Map(allFields.map((field) => [field.key, field]));
    const setIfEmpty = (key: string, value: string | null) => {
      const field = fields.get(key);
      if (field && !details.get(key)) {
        setDetails((prev) => prev.set(key, value));
        setTimeout(() => fieldUpdated(field), 0);
      }
    };

    if (fields.get("email")?.required) {
      setIfEmpty("email", billingDetails.email);
    }
    setIfEmpty(KEY_LEGAL_TYPE, billingDetails.legal_type);
    setIfEmpty(KEY_ACCOUNT_HOLDER_NAME, billingDetails.billing_entity_name);
    setIfEmpty(KEY_ADDRESS_COUNTRY, billingDetails.country_code);

    const stateField = fields.get(KEY_ADDRESS_STATE);
    if (stateField?.type === "select" && !details.get(KEY_ADDRESS_STATE)) {
      const key = stateField.valuesAllowed?.find(
        (state) => state.name === billingDetails.state || state.key === billingDetails.state,
      )?.key;
      if (key) {
        setDetails((prev) => prev.set(KEY_ADDRESS_STATE, key));
      }
    }

    const accountType = fields.get(KEY_ACCOUNT_TYPE);
    if (accountType?.type === "radio" && !details.get(KEY_ACCOUNT_TYPE)) {
      const key = accountType.valuesAllowed?.find((account) => account.key === KEY_CHECKING_ACCOUNT)?.key;
      if (key) {
        setDetails((prev) => prev.set(KEY_ACCOUNT_TYPE, key));
      }
    }

    setIfEmpty(KEY_ADDRESS_CITY, billingDetails.city);
    setIfEmpty(KEY_ADDRESS_POST_CODE, billingDetails.zip_code);
    setIfEmpty(KEY_ADDRESS_FIRST_LINE, billingDetails.street_address);
  }, [allFields, billingDetails]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle>Bank account</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 py-1">
          <div className="grid gap-2">
            <Label htmlFor={`currency-${uid}`}>Currency</Label>
            <ComboBox
              id={`currency-${uid}`}
              value={currency}
              modal
              onChange={(value) => setCurrency(z.enum(currencyCodes).parse(value))}
              options={CURRENCIES.map(({ value, name }) => ({ value, label: name }))}
            />
            {formSwitch ? (
              <Checkbox
                checked={(selectedFormIndex !== defaultFormIndex) !== formSwitch.defaultOn}
                role="switch"
                label={formSwitch.label}
                disabled={isPending}
                onCheckedChange={() => setSelectedFormIndex((prev) => (prev + 1) % 2)}
              />
            ) : null}
          </div>

          {forms.length > 2 ? (
            <div className="grid gap-2">
              <Label htmlFor={`form-${uid}`}>Transfer method</Label>
              <Tabs
                value={selectedFormIndex.toString()}
                onValueChange={(value: string) => setSelectedFormIndex(parseInt(value, 10))}
              >
                <TabsList className="w-full">
                  {forms.map((form, index) => (
                    <TabsTrigger key={form.type} value={index.toString()}>
                      {form.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          ) : null}

          {Object.values(groupedFields).map((fieldGroup, index) => {
            if (!fieldGroup) return;
            const gridCols =
              fieldGroup.length === 3 ? "md:grid-cols-3" : fieldGroup.length === 2 ? "md:grid-cols-2" : "";
            return (
              <div key={`group-${index}`} className={cn("grid grid-cols-1 items-start gap-4", gridCols)}>
                {fieldGroup.map((field) => {
                  if (field.type === "select" || field.type === "radio") {
                    const errorMessage = errors.get(field.key);
                    const selectOptions = (field.valuesAllowed ?? []).map(({ key, name }) => ({
                      value: key,
                      label: name,
                    }));

                    return (
                      <div key={field.key} className="grid gap-2">
                        <Label
                          className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          htmlFor={field.key}
                        >
                          {field.name}
                        </Label>
                        <ComboBox
                          id={field.key}
                          value={details.get(field.key) ?? ""}
                          onChange={(value) => {
                            setDetails((prev) => prev.set(field.key, value));
                            setTimeout(() => fieldUpdated(field), 0);
                          }}
                          modal
                          options={selectOptions}
                          disabled={isPending}
                          className={cn(errors.has(field.key) && "border-red-500 focus-visible:ring-red-500")}
                        />
                        {errorMessage ? <div className="text-sm text-red-500">{errorMessage}</div> : null}
                      </div>
                    );
                  }

                  return (
                    <BankAccountField
                      key={field.key}
                      value={details.get(field.key) ?? ""}
                      onChange={(value) => {
                        setDetails((prev) => prev.set(field.key, value));
                        setTimeout(() => fieldUpdated(field), 0);
                      }}
                      field={field}
                      invalid={errors.has(field.key)}
                      help={errors.get(field.key)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="pt-4">
          <div className="flex justify-end">
            <MutationButton
              mutation={submitMutation}
              loadingText="Saving bank account..."
              disabled={hasRequiredFieldsEmpty || hasVisibleErrors}
            >
              Save bank account
            </MutationButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BankAccountField = ({
  onChange,
  field,
  invalid,
  help,
  ...inputProps
}: { field: InputField; onChange: (value: string) => void; invalid?: boolean; help?: string | undefined } & Omit<
  React.ComponentProps<typeof Input>,
  "onChange"
>) => {
  const id = useId();

  const applyDisplayFormat = (inputValue: string, cursorPosition = 0) => {
    // This masking is very simple and assumes formats are alphanumeric with single punctuation characters
    if (!field.displayFormat || !inputValue) return { value: inputValue, cursorPosition };

    let index = 0;

    const value = Array.from(inputValue).filter((c) => /[A-Z0-9]/iu.test(c));

    const formatted = Array.from(field.displayFormat)
      .map((c, i) => {
        if (index >= value.length) return "";
        if (c === "*") return value.at(index++);
        if (i === cursorPosition - 1 && inputValue[i] !== c) cursorPosition += 1;
        return c;
      })
      .join("");

    return { value: formatted.slice(0, field.maxLength ?? undefined), cursorPosition };
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{field.name}</Label>
      <Input
        id={id}
        type={field.type}
        placeholder={applyDisplayFormat(field.example).value}
        maxLength={field.maxLength ?? undefined}
        onChange={(e) => {
          const { value, cursorPosition } = applyDisplayFormat(e.target.value, e.target.selectionEnd ?? 0);
          onChange(value);

          requestAnimationFrame(() => e.target.setSelectionRange(cursorPosition, cursorPosition));
        }}
        aria-invalid={invalid}
        className={cn(invalid && "border-red-500 focus-visible:ring-red-500", inputProps.className)}
        {...inputProps}
      />
      {help ? <div className={cn("text-sm", invalid && "text-red-500")}>{help}</div> : null}
    </div>
  );
};

export default BankAccountModal;
