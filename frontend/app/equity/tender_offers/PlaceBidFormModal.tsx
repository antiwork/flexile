import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormControl, FormLabel, FormMessage } from "@/components/ui/form";
import NumberInput from "@/components/NumberInput";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { VESTED_SHARES_CLASS } from "./";

type TenderOffer = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  minimumValuation: bigint;
  attachment?: {
    key: string;
    filename: string;
  };
};

type PlaceBidFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  tenderOffer: TenderOffer;
};

const formSchema = z.object({
  shareClass: z.string().min(1, "This field is required"),
  numberOfShares: z.number().min(1),
  pricePerShare: z.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;

const PlaceBidFormModal = ({ isOpen, onClose, onBack, tenderOffer }: PlaceBidFormModalProps) => {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const investorId = user.roles.investor?.id;

  const { data: ownShareHoldings } = trpc.shareHoldings.sumByShareClass.useQuery(
    { companyId: company.id, investorId },
    { enabled: !!investorId },
  );
  const { data: ownTotalVestedShares } = trpc.equityGrants.sumVestedShares.useQuery(
    { companyId: company.id, investorId },
    { enabled: !!investorId },
  );

  const holdings = useMemo(
    () =>
      ownShareHoldings
        ? ownTotalVestedShares
          ? [...ownShareHoldings, { className: VESTED_SHARES_CLASS, count: ownTotalVestedShares }]
          : ownShareHoldings
        : [],
    [ownShareHoldings, ownTotalVestedShares],
  );

  const form = useForm<FormValues>({
    defaultValues: { shareClass: holdings[0]?.className ?? "", pricePerShare: 0, numberOfShares: 0 },
    resolver: zodResolver(formSchema),
  });

  const numberOfShares = form.watch("numberOfShares");
  const pricePerShare = form.watch("pricePerShare");
  const shareClass = form.watch("shareClass");
  const maxShares = holdings.find((h) => h.className === shareClass)?.count || 0;

  const createMutation = trpc.tenderOffers.bids.create.useMutation({
    onSuccess: () => {
      form.reset();
      onClose();
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    if (values.numberOfShares > maxShares) {
      return form.setError("numberOfShares", {
        message: `Number of shares must be between 1 and ${maxShares.toLocaleString()}`,
      });
    }
    await createMutation.mutateAsync({
      companyId: company.id,
      tenderOfferId: tenderOffer.id,
      numberOfShares: Number(values.numberOfShares),
      sharePriceCents: Math.round(Number(values.pricePerShare) * 100),
      shareClass: values.shareClass,
    });
  });

  const impliedValuation = company.fullyDilutedShares ? company.fullyDilutedShares * pricePerShare : 0;
  const totalAmount = numberOfShares * pricePerShare;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-md flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Place a bid</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <p className="mb-4 shrink-0 text-sm text-gray-600">
            Submit an offer to sell your shares in this buyback event.
          </p>

          <Form {...form}>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col gap-4">
              <FormField
                control={form.control}
                name="shareClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Share class</FormLabel>
                    <FormControl>
                      <ComboBox
                        {...field}
                        placeholder="Select..."
                        options={holdings.map((holding) => ({
                          value: holding.className,
                          label: `${holding.className} (${holding.count.toLocaleString()} shares)`,
                        }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numberOfShares"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of shares</FormLabel>
                      <FormControl>
                        <NumberInput {...field} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricePerShare"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per share</FormLabel>
                      <FormControl>
                        <NumberInput {...field} decimal prefix="$" placeholder="$ 0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Implied company valuation</span>
                  <span className="font-medium">{formatMoney(impliedValuation)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Total amount</span>
                  <span>{formatMoney(totalAmount)}</span>
                </div>
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            Back
          </Button>
          <MutationStatusButton
            onClick={() => void handleSubmit()}
            mutation={createMutation}
            className="w-full sm:w-auto"
            disabled={!form.formState.isValid || numberOfShares === 0 || pricePerShare === 0}
          >
            Submit bid
          </MutationStatusButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlaceBidFormModal;
