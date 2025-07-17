import { zodResolver } from "@hookform/resolvers/zod";
import { TRPCClientError } from "@trpc/client";
import { fromUnixTime } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

const formSchema = z.object({ verificationCode: z.string().length(6, "Please enter a 6-digit code.") }).or(
  z.object({
    firstAmount: z.number().min(1, "Please enter an amount."),
    secondAmount: z.number().min(1, "Please enter an amount."),
  }),
);

const StripeMicrodepositVerification = () => {
  const company = useCurrentCompany();
  const searchParams = useSearchParams();

  const [{ microdepositVerificationDetails }] = trpc.companies.microdepositVerificationDetails.useSuspenseQuery({
    companyId: company.id,
  });
  const microdepositVerification = trpc.companies.microdepositVerification.useMutation({
    onSuccess: () => setShowVerificationModal(false),
  });
  const [showVerificationModal, setShowVerificationModal] = useState(
    searchParams.get("open-modal") === "microdeposits",
  );
  const isDescriptorCode = microdepositVerificationDetails?.microdeposit_type === "descriptor_code";
  const form = useForm({
    defaultValues: isDescriptorCode ? { verificationCode: "" } : { firstAmount: 0, secondAmount: 0 },
    resolver: zodResolver(formSchema),
  });

  const arrivalDate =
    microdepositVerificationDetails && formatDate(fromUnixTime(microdepositVerificationDetails.arrival_timestamp));

  const submit = form.handleSubmit(async (values) => {
    try {
      await microdepositVerification.mutateAsync({
        companyId: company.id,
        ...(values.verificationCode
          ? { code: values.verificationCode }
          : { amounts: [(values.firstAmount || 0) * 100, (values.secondAmount || 0) * 100] }),
      });
    } catch (error) {
      if (error instanceof TRPCClientError) {
        if (isDescriptorCode) {
          form.setError("verificationCode", {
            message:
              error.message ||
              `Invalid code. Please ensure you're entering the correct 6-digit code from the $0.01 Stripe deposit on ${arrivalDate}`,
          });
        } else {
          form.setError("secondAmount", {
            message:
              error.message ||
              `Incorrect deposit amounts. Please ensure you're entering the amounts from the Stripe deposits on ${arrivalDate}`,
          });
        }
      } else throw error;
    }
  });

  return !microdepositVerificationDetails || microdepositVerification.isSuccess ? null : (
    <>
      <Alert>
        <AlertTitle>Verify your bank account to enable contractor payments</AlertTitle>
        <AlertDescription>
          <p>To ensure seamless payments to your contractors, we need to confirm your bank account details.</p>
          <Button onClick={() => setShowVerificationModal(true)}>Verify bank account</Button>
        </AlertDescription>
      </Alert>

      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your bank account</DialogTitle>
          </DialogHeader>
          {microdepositVerificationDetails.microdeposit_type === "descriptor_code" ? (
            <p>
              Check your {microdepositVerificationDetails.bank_account_number || ""} bank account for a $0.01 deposit
              from Stripe on {arrivalDate}. The transaction's description will have your 6-digit verification code
              starting with 'SM'.
            </p>
          ) : (
            <p>
              Check your {microdepositVerificationDetails.bank_account_number || ""} bank account for
              <strong>two deposits</strong> from Stripe on {arrivalDate}. The transactions' description will read
              "ACCTVERIFY".
            </p>
          )}

          <p>If {isDescriptorCode ? "it's" : "they're"} not visible yet, please check in 1-2 days.</p>

          <Form {...form}>
            <form onSubmit={(e) => void submit(e)}>
              {isDescriptorCode ? (
                <FormField
                  control={form.control}
                  name="verificationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>6-digit code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="firstAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount 1</FormLabel>
                        <FormControl>
                          <NumberInput {...field} prefix="$" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="secondAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount 2</FormLabel>
                        <FormControl>
                          <NumberInput {...field} prefix="$" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter>
                <MutationStatusButton type="submit" loadingText="Submitting..." mutation={microdepositVerification}>
                  Submit
                </MutationStatusButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StripeMicrodepositVerification;
