import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { fromUnixTime } from "date-fns";
import { Map } from "immutable";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { assert } from "@/utils/assert";
import { formatDate } from "@/utils/time";

const StripeMicrodepositVerification = () => {
  const company = useCurrentCompany();
  const searchParams = useSearchParams();

  const [{ microdepositVerificationDetails }] = trpc.companies.microdepositVerificationDetails.useSuspenseQuery({
    companyId: company.id,
  });
  const microdepositVerification = trpc.companies.microdepositVerification.useMutation();
  const [showVerificationModal, setShowVerificationModal] = useState(
    searchParams.get("open-modal") === "microdeposits",
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [firstAmount, setFirstAmount] = useState<number | null>(null);
  const [secondAmount, setSecondAmount] = useState<number | null>(null);
  const [errors, setErrors] = useState(Map<string, string>());
  const data = { verificationCode, firstAmount, secondAmount };
  Object.entries(data).forEach(([key, value]) => useEffect(() => setErrors(errors.delete(key)), [value]));

  const arrivalDate =
    microdepositVerificationDetails && formatDate(fromUnixTime(microdepositVerificationDetails.arrival_timestamp));

  const verifyMicrodeposit = useMutation({
    mutationFn: async () => {
      assert(microdepositVerificationDetails != null);
      const newErrors = errors.clear().withMutations((errors) => {
        if (microdepositVerificationDetails.microdeposit_type === "descriptor_code") {
          if (verificationCode.length !== 6) errors.set("verificationCode", "Please enter a 6-digit code.");
        } else {
          if (!firstAmount) errors.set("firstAmount", "Please enter an amount.");
          if (!secondAmount) errors.set("secondAmount", "Please enter an amount.");
        }
      });
      setErrors(newErrors);
      if (newErrors.size > 0) throw new Error("Invalid input");

      try {
        await microdepositVerification.mutateAsync({
          companyId: company.id,
          ...(microdepositVerificationDetails.microdeposit_type === "descriptor_code"
            ? { code: verificationCode }
            : { amounts: [(firstAmount || 0) * 100, (secondAmount || 0) * 100] }),
        });
      } catch (error) {
        if (error instanceof TRPCClientError) {
          if (microdepositVerificationDetails.microdeposit_type === "descriptor_code") {
            errors.set(
              "verificationCode",
              error.message ||
                `Invalid code. Please ensure you're entering the correct 6-digit code from the $0.01 Stripe deposit on ${arrivalDate}`,
            );
          } else {
            errors.set(
              "secondAmount",
              error.message ||
                `Incorrect deposit amounts. Please ensure you're entering the amounts from the Stripe deposits on ${arrivalDate}`,
            );
          }
        } else throw error;
      }
    },
    onSuccess: () => setShowVerificationModal(false),
  });

  return !microdepositVerificationDetails || verifyMicrodeposit.isSuccess ? null : (
    <>
      <Alert>
        <AlertTitle>Verify your bank account to enable contractor payments</AlertTitle>
        <AlertDescription>
          <p>To ensure seamless payments to your contractors, we need to confirm your bank account details.</p>
          <Button onClick={() => setShowVerificationModal(true)}>Verify bank account</Button>
        </AlertDescription>
      </Alert>

      <Modal
        open={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        title="Verify your bank account"
      >
        {microdepositVerificationDetails.microdeposit_type === "descriptor_code" ? (
          <p>
            Check your {microdepositVerificationDetails.bank_account_number || ""} bank account for a $0.01 deposit from
            Stripe on {arrivalDate}. The transaction's description will have your 6-digit verification code starting
            with 'SM'.
          </p>
        ) : (
          <p>
            Check your {microdepositVerificationDetails.bank_account_number || ""} bank account for
            <strong>two deposits</strong> from Stripe on {arrivalDate}. The transactions' description will read
            "ACCTVERIFY".
          </p>
        )}

        <p>
          If {microdepositVerificationDetails.microdeposit_type === "descriptor_code" ? "it's" : "they're"} not visible
          yet, please check in 1-2 days.
        </p>

        {microdepositVerificationDetails.microdeposit_type === "descriptor_code" ? (
          <Input
            value={verificationCode}
            onChange={setVerificationCode}
            label="6-digit code"
            invalid={errors.has("verificationCode")}
            help={errors.get("verificationCode")}
          />
        ) : (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="amount-1">Amount 1</Label>
              <NumberInput
                id="amount-1"
                value={firstAmount}
                onChange={(value) => setFirstAmount(value)}
                invalid={errors.has("firstAmount")}
                prefix="$"
                decimal
                {...(errors.has("firstAmount") && { "aria-invalid": true })}
              />
              {errors.get("firstAmount") && (
                <span className="text-destructive text-sm">{errors.get("firstAmount")}</span>
              )}
            </div>

            <div>
              <Label htmlFor="amount-2">Amount 2</Label>
              <NumberInput
                id="amount-2"
                value={secondAmount}
                onChange={(value) => setSecondAmount(value)}
                invalid={errors.has("secondAmount")}
                prefix="$"
                decimal
                {...(errors.has("secondAmount") && { "aria-invalid": true })}
              />
              {errors.get("secondAmount") && (
                <span className="text-destructive text-sm">{errors.get("secondAmount")}</span>
              )}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <MutationButton loadingText="Submitting..." mutation={verifyMicrodeposit}>
            Submit
          </MutationButton>
        </div>
      </Modal>
    </>
  );
};

export default StripeMicrodepositVerification;
