"use client";

import { AlertTriangle, Check, Plus, CircleDollarSign } from "lucide-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import React, { Fragment, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { currencyCodes, sanctionedCountries, supportedCountries } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { isEthereumAddress } from "@/utils/isEthereumAddress";
import { request } from "@/utils/request";
import { settings_bank_account_path, settings_bank_accounts_path, settings_dividend_path } from "@/utils/routes";
import SettingsLayout from "@/app/settings/layout";
import BankAccountModal, { type BankAccount, bankAccountSchema } from "./BankAccountModal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormLabel, FormMessage, FormControl, FormItem, FormField } from "@/components/ui/form";
import { Card, CardTitle, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

export default function PayoutsPage() {
  const user = useCurrentUser();

  return (
    <SettingsLayout>
      <h2 className="mb-8 text-xl font-medium">Payouts</h2>
      <div className="grid gap-8">
        {user.roles.investor ? <DividendSection /> : null}
        <BankAccountsSection />
      </div>
    </SettingsLayout>
  );
}

const dividendsFormSchema = z.object({
  minimumDividendPaymentAmount: z.number(),
});

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

  const form = useForm({
    defaultValues: {
      minimumDividendPaymentAmount: data.minimum_dividend_payment_in_cents / 100,
    },
    resolver: zodResolver(dividendsFormSchema),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof dividendsFormSchema>) => {
      await request({
        method: "PATCH",
        accept: "json",
        url: settings_dividend_path(),
        jsonData: {
          user: {
            minimum_dividend_payment_in_cents: values.minimumDividendPaymentAmount * 100,
          },
        },
        assertOk: true,
      });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dividends</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <FormField
              control={form.control}
              name="minimumDividendPaymentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum dividend payout amount</FormLabel>
                  <FormControl>
                    <NumberInput
                      {...field}
                      max={data.max_minimum_dividend_payment_in_cents / 100}
                      min={data.min_minimum_dividend_payment_in_cents / 100}
                      step={0.01}
                      placeholder="10"
                      prefix="$"
                    />
                  </FormControl>
                  <FormMessage>
                    Payments below this threshold will be retained. This change will affect all companies you invested
                    in through Flexile.
                  </FormMessage>
                </FormItem>
              )}
            />
            <CardFooter className="justify-start p-0">
              <MutationStatusButton
                type="submit"
                mutation={saveMutation}
                loadingText="Saving..."
                successText="Saved!"
                className="justify-self-end"
              >
                Save changes
              </MutationStatusButton>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
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
          city: z.string().nullable(),
          zip_code: z.string().nullable(),
          street_address: z.string().nullable(),
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout method</CardTitle>
      </CardHeader>
      <CardContent>
        {bankAccounts.length === 0 && user.roles.investor ? (
          <div className="p-4">
            <div className="grid justify-items-center gap-4 p-6 text-center text-gray-700">
              <CircleDollarSign className="-mb-2 size-10" />
              <p>Set up your bank account to receive payouts.</p>
              <Button onClick={() => setAddingBankAccount(true)} variant="outline">
                <Plus className="size-4" />
                Add bank account
              </Button>
            </div>
          </div>
        ) : isFromSanctionedCountry ? (
          <div>
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
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
                    <h2 className="text-xl font-semibold">{bankAccount.currency} bank account</h2>
                    <div className="text-sm">Ending in {bankAccount.last_four_digits}</div>
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
            {user.roles.investor || user.roles.worker ? (
              <>
                {bankAccounts.length > 0 ? <Separator /> : null}
                <div>
                  <Button onClick={() => setAddingBankAccount(true)} variant="outline">
                    <Plus className="size-4" />
                    Add bank account
                  </Button>
                </div>
              </>
            ) : null}
          </>
        )}
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
      </CardContent>
    </Card>
  );
};

const walletAddressSchema = z.object({
  walletAddress: z.string().refine(isEthereumAddress, "The entered address is not a valid Ethereum address."),
});

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
  const form = useForm({
    defaultValues: { walletAddress: value },
    resolver: zodResolver(walletAddressSchema),
  });
  const company = useCurrentCompany();

  const walletUpdateMutation = trpc.wallets.update.useMutation({
    onSuccess: () => {
      onClose();
      onComplete(form.getValues("walletAddress"));
    },
  });
  const submit = form.handleSubmit((values) => walletUpdateMutation.mutateAsync({ companyId: company.id, ...values }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Get paid with ETH</DialogTitle>
        </DialogHeader>
        <div className="text-gray-500">
          Payments will be sent to the specified Ethereum address. The amount will be based on the current exchange
          rate, and Flexile will cover network fees.
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Ethereum transactions are irreversible. Please double-check your address before saving.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={(e) => void submit(e)}>
            <FormField
              control={form.control}
              name="walletAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ethereum wallet address (ERC20 Network)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Paste or type your ETH address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-6 flex justify-end">
              <MutationStatusButton mutation={walletUpdateMutation} disabled={!form.formState.isValid}>
                Save
              </MutationStatusButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
