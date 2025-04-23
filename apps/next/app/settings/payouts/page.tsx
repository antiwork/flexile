"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import React, { Fragment, useEffect, useRef, useState } from "react";
import { z } from "zod";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { currencyCodes, sanctionedCountries, supportedCountries } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { e } from "@/utils";
import { isEthereumAddress } from "@/utils/isEthereumAddress";
import { request } from "@/utils/request";
import { settings_bank_account_path, settings_bank_accounts_path, settings_dividend_path } from "@/utils/routes";
import SettingsLayout from "../Layout";
import BankAccountModal, { type BankAccount, bankAccountSchema } from "./BankAccountModal";

export default function PayoutsPage() {
  const user = useCurrentUser();

  return (
    <SettingsLayout>
      {user.roles.investor ? <DividendSection /> : null}
      <BankAccountsSection />
    </SettingsLayout>
  );
}

const DividendSection = () => {
  const { data } = useSuspenseQuery({
    queryKey: ["settings", "dividend"],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        accept: "json",
        url: settings_dividend_path(),
        assertOk: true,
      });
      return z
        .object({
          minimum_dividend_payment_in_cents: z.number(),
          max_minimum_dividend_payment_in_cents: z.number(),
          min_minimum_dividend_payment_in_cents: z.number(),
        })
        .parse(await response.json());
    },
  });

  const [minimumDividendPaymentAmount, setMinimumDividendPaymentAmount] = useState<number | null>(
    data.minimum_dividend_payment_in_cents / 100,
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      await request({
        method: "PATCH",
        accept: "json",
        url: settings_dividend_path(),
        jsonData: {
          user: {
            minimum_dividend_payment_in_cents: (minimumDividendPaymentAmount ?? 0) * 100,
          },
        },
        assertOk: true,
      });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  return (
    <FormSection title="Dividends" onSubmit={e(() => saveMutation.mutate(), "prevent")}>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="minimum-dividend-payment">Minimum dividend payout amount</Label>
          <NumberInput
            id="minimum-dividend-payment"
            value={minimumDividendPaymentAmount}
            onChange={setMinimumDividendPaymentAmount}
            max={data.max_minimum_dividend_payment_in_cents / 100}
            min={data.min_minimum_dividend_payment_in_cents / 100}
            step={0.01}
            placeholder="10"
            prefix="$"
          />
          <p className="text-muted-foreground text-sm">Payments below this threshold will be retained.</p>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-4">
        <MutationButton type="submit" mutation={saveMutation} loadingText="Saving...">
          Save changes
        </MutationButton>
        <div>This change will affect all companies you invested in through Flexile.</div>
      </CardFooter>
    </FormSection>
  );
};

const BankAccountsSection = () => {
  const user = useCurrentUser();
  const { data } = useSuspenseQuery({
    queryKey: ["settings", "bank_accounts"],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        accept: "json",
        url: settings_bank_accounts_path(),
      });
      return z
        .object({
          email: z.string(),
          country_code: z.string(),
          citizenship_country_code: z.string(),
          country: z.string(),
          state: z.string().nullable(),
          city: z.string(),
          zip_code: z.string(),
          street_address: z.string(),
          billing_entity_name: z.string(),
          legal_type: z.enum(["BUSINESS", "PRIVATE"]),
          bank_account_currency: z.enum(currencyCodes).nullable(),
          wallet_address: z.string().nullable(),
          bank_accounts: z.array(bankAccountSchema),
        })
        .parse(await response.json());
    },
  });

  const [editingWalletPayoutMethod, setEditingWalletPayoutMethod] = useState(false);
  const [walletAddress, setWalletAddress] = useState(data.wallet_address || "");
  const [bankAccounts, setBankAccounts] = useState(data.bank_accounts);
  const [addingBankAccount, setAddingBankAccount] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [bankAccountForInvoices, setBankAccountForInvoices] = useState(
    data.bank_accounts.find((bankAccount) => bankAccount.used_for_invoices)?.id,
  );
  const [bankAccountForDividends, setBankAccountForDividends] = useState(
    data.bank_accounts.find((bankAccount) => bankAccount.used_for_dividends)?.id,
  );

  const isFromSanctionedCountry = sanctionedCountries.has(data.country_code);
  const showWalletPayoutMethod = user.roles.investor && !supportedCountries.has(data.country_code);

  const useBankAccountMutation = useMutation({
    mutationFn: async ({ bankAccountId, useFor }: { bankAccountId: number; useFor: "invoices" | "dividends" }) => {
      await request({
        method: "PATCH",
        accept: "json",
        url: settings_bank_account_path(bankAccountId),
        jsonData: {
          bank_account: {
            used_for_invoices: useFor === "invoices",
            used_for_dividends: useFor === "dividends",
          },
        },
        assertOk: true,
      });
      if (useFor === "invoices") setBankAccountForInvoices(bankAccountId);
      else setBankAccountForDividends(bankAccountId);
    },
  });

  const bankAccountUsage = (bankAccount: BankAccount) => {
    const isUsedForInvoices = bankAccount.id === bankAccountForInvoices;
    const isUsedForDividends = bankAccount.id === bankAccountForDividends && user.roles.investor != null;

    if (!isUsedForInvoices && !isUsedForDividends) return "";

    return (
      <div className="flex flex-col pt-2">
        {isUsedForInvoices ? (
          <div className="flex items-center">
            <Check className="mr-1 size-4" /> Used for invoices
          </div>
        ) : null}
        {isUsedForDividends ? (
          <div className="flex items-center">
            <Check className="mr-1 size-4" /> Used for dividends
          </div>
        ) : null}
      </div>
    );
  };

  if (!isFromSanctionedCountry && !showWalletPayoutMethod && !data.bank_account_currency) return null;

  return (
    <FormSection title="Payout method">
      <CardContent>
        {isFromSanctionedCountry ? (
          <div>
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertTitle>Payouts are disabled</AlertTitle>
              <AlertDescription>
                Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals
                from sanctioned countries are unable to receive payments through our platform.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            {showWalletPayoutMethod ? (
              <>
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-xl font-bold">ETH wallet</h2>
                    <div className="text-xs">{walletAddress}</div>
                  </div>
                  <Button variant="outline" onClick={() => setEditingWalletPayoutMethod(true)}>
                    Edit
                  </Button>
                  <WalletAddressModal
                    open={editingWalletPayoutMethod}
                    value={walletAddress}
                    onClose={() => setEditingWalletPayoutMethod(false)}
                    onComplete={setWalletAddress}
                  />
                </div>
                <Separator />
              </>
            ) : null}

            {bankAccounts.map((bankAccount, index) => (
              <Fragment key={bankAccount.id}>
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{bankAccount.currency} bank account</h2>
                    <div className="text-xs">Ending in {bankAccount.last_four_digits}</div>
                    {bankAccounts.length > 1 && bankAccountUsage(bankAccount)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {bankAccounts.length > 1 ? (
                      <>
                        {bankAccount.id !== bankAccountForInvoices && (
                          <MutationButton
                            idleVariant="outline"
                            mutation={useBankAccountMutation}
                            param={{ bankAccountId: bankAccount.id, useFor: "invoices" as const }}
                            loadingText={
                              useBankAccountMutation.variables?.bankAccountId === bankAccount.id
                                ? "Updating..."
                                : undefined
                            }
                          >
                            Use for invoices
                          </MutationButton>
                        )}

                        {bankAccount.id !== bankAccountForDividends && user.roles.investor ? (
                          <MutationButton
                            idleVariant="outline"
                            mutation={useBankAccountMutation}
                            param={{ bankAccountId: bankAccount.id, useFor: "dividends" as const }}
                            loadingText={
                              useBankAccountMutation.variables?.bankAccountId === bankAccount.id
                                ? "Updating..."
                                : undefined
                            }
                          >
                            Use for dividends
                          </MutationButton>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setEditingBankAccount(bankAccount)}>
                          Edit
                        </Button>
                        {editingBankAccount ? (
                          <BankAccountModal
                            open={!!editingBankAccount}
                            billingDetails={data}
                            bankAccount={editingBankAccount}
                            onClose={() => setEditingBankAccount(null)}
                            onComplete={(result) => {
                              Object.assign(editingBankAccount, result);
                              setEditingBankAccount(null);
                            }}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {index !== bankAccounts.length - 1 && <Separator />}
              </Fragment>
            ))}

            {user.roles.investor ? (
              <>
                <Separator />
                <div>
                  {addingBankAccount ? (
                    <BankAccountModal
                      open={addingBankAccount}
                      billingDetails={data}
                      onClose={() => setAddingBankAccount(false)}
                      onComplete={(result) => {
                        setBankAccounts((prev) => [...prev, result]);
                        setAddingBankAccount(false);
                      }}
                    />
                  ) : null}
                  <Button onClick={() => setAddingBankAccount(true)}>Add bank account</Button>
                </div>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </FormSection>
  );
};

const WalletAddressModal = ({
  open,
  onClose,
  value,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onComplete: (address: string) => void;
}) => {
  const [walletAddress, setWalletAddress] = useState(value);
  const [hasFormatError, setHasFormatError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const company = useCurrentCompany();

  useEffect(() => setHasFormatError(false), [walletAddress]);

  const walletUpdateMutation = trpc.wallets.update.useMutation();
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isEthereumAddress(walletAddress)) {
        setHasFormatError(true);
        inputRef.current?.focus();
        return;
      }
      await walletUpdateMutation.mutateAsync({ companyId: company.id, walletAddress });
      onClose();
      onComplete(walletAddress);
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Get paid with ETH">
      <div className="text-gray-500">
        Payments will be sent to the specified Ethereum address. The amount will be based on the current exchange rate,
        and Flexile will cover network fees.
      </div>

      <Alert variant="destructive">
        <ExclamationTriangleIcon />
        <AlertDescription>
          Ethereum transactions are irreversible. Please double-check your address before saving.
        </AlertDescription>
      </Alert>

      <Input
        ref={inputRef}
        value={walletAddress}
        onChange={setWalletAddress}
        label="Ethereum wallet address (ERC20 Network)"
        aria-label="Wallet address"
        placeholder="Paste or type your ETH address"
        invalid={hasFormatError}
        help={
          hasFormatError
            ? "The entered address is not a valid Ethereum address."
            : "An Ethereum address is alphanumeric and always starts with 0x."
        }
      />

      <div className="mt-6 flex justify-end">
        <MutationButton mutation={saveMutation} disabled={!walletAddress}>
          Save
        </MutationButton>
      </div>
    </Modal>
  );
};
