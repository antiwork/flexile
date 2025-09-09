import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import MutationButton from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { DIVIDEND_BASE_FEE_CENTS, DIVIDEND_MAX_FEE_CENTS, DIVIDEND_PERCENTAGE } from "@/utils/fees";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_dividend_rounds_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import type { DividendComputation } from "./page";

const FinalizeDistributionModal = ({
  open,
  onOpenChange,
  dividendComputation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dividendComputation: DividendComputation;
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const company = useCurrentCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "POST",
        accept: "json",
        url: company_dividend_rounds_path(company.id, { dividend_computation_id: dividendComputation.id }),
        assertOk: true,
      });
      return z.object({ id: z.string() }).parse(await response.json());
    },
    onSuccess: ({ id }) => {
      onOpenChange(false);
      router.push(`/equity/dividend_rounds/round/${id}`);
      void queryClient.invalidateQueries({ queryKey: ["dividendComputations", company.id] });
      void utils.dividendRounds.list.invalidate({ companyId: company.id });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="small">
          Finalize distribution
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribution details</DialogTitle>
          <DialogDescription>
            Please confirm all details are accurate. After finalization, shareholders will be notified, payments
            scheduled, and funds pulled from your connected account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Distribution type:</span>
            <span>{dividendComputation.return_of_capital ? "Return of capital" : "Dividends"}</span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <span>Payment date:</span>
            <span>{formatDate(dividendComputation.dividends_issuance_date)}</span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <span>Shareholders:</span>
            <span>{dividendComputation.number_of_shareholders.toLocaleString()}</span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <span>Distribution amount:</span>
            <span>{formatMoney(dividendComputation.total_amount_in_usd)}</span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <div>
              <div>Processing fees:</div>
              <div className="mt-1 text-sm text-gray-500">
                {formatMoneyFromCents(DIVIDEND_BASE_FEE_CENTS)} + {DIVIDEND_PERCENTAGE}%, up to{" "}
                {formatMoneyFromCents(DIVIDEND_MAX_FEE_CENTS)}/investor
              </div>
            </div>
            <span>{formatMoneyFromCents(dividendComputation.total_fees_cents)}</span>
          </div>

          <Separator />

          <div className="mb-2 flex justify-between font-medium">
            <span>Total cost:</span>
            <span>
              {formatMoneyFromCents(
                Number(dividendComputation.total_amount_in_usd) * 100 + dividendComputation.total_fees_cents,
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={isConfirmed}
            onCheckedChange={(checked) => setIsConfirmed(checked === true)}
            label="I've reviewed all information and confirm it's correct."
          />
        </div>
        <DialogFooter>
          <MutationButton
            mutation={finalizeMutation}
            disabled={!isConfirmed}
            loadingText="Finalizing..."
            errorText={finalizeMutation.error?.message || "Something went wrong. Please try again."}
          >
            Finalize distribution
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalizeDistributionModal;
