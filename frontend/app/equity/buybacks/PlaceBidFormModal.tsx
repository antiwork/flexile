import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offer_bids_path } from "@/utils/routes";
import { type Buyback, placeBuybackBidSchema, VESTED_SHARES_CLASS } from ".";

type PlaceBidFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  buyback: Buyback;
};

const formSchema = placeBuybackBidSchema
  .pick({
    share_class: true,
    number_of_shares: true,
  })
  .extend({
    share_price: z.number({ coerce: true }).min(0),
  });

type BuybackBidFormValues = z.infer<typeof formSchema>;

const PlaceBidFormModal = ({ isOpen, onClose, onBack, buyback }: PlaceBidFormModalProps) => {
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

  const form = useForm<BuybackBidFormValues>({
    defaultValues: { share_class: holdings[0]?.className ?? "", share_price: 0, number_of_shares: 0 },
    resolver: zodResolver(formSchema),
  });

  const numberOfShares = form.watch("number_of_shares");
  const pricePerShare = form.watch("share_price");
  const shareClass = form.watch("share_class");
  const maxShares = holdings.find((h) => h.className === shareClass)?.count || 0;

  const createMutation = useMutation({
    mutationFn: async (data: BuybackBidFormValues) => {
      await request({
        method: "POST",
        url: company_tender_offer_bids_path(company.id, buyback.id),
        accept: "json",
        jsonData: placeBuybackBidSchema.parse({
          number_of_shares: Number(data.number_of_shares),
          share_price_cents: Math.round(Number(data.share_price) * 100),
          share_class: data.share_class,
        }),
        assertOk: true,
      });
    },
    onSuccess: () => {
      form.reset();
      onClose();
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    if (values.number_of_shares > maxShares) {
      return form.setError("number_of_shares", {
        message: `Number of shares must be between 1 and ${maxShares.toLocaleString()}`,
      });
    }
    createMutation.mutate(values);
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
          <p className="mb-4 shrink-0 text-sm">Submit an offer to sell your shares in this buyback event.</p>

          <Form {...form}>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col gap-4">
              <FormField
                control={form.control}
                name="share_class"
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
                  name="number_of_shares"
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
                  name="share_price"
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
                  <span className="font-medium">Implied company valuation</span>
                  <span>{formatMoney(impliedValuation)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Total amount</span>
                  <span>{formatMoney(totalAmount)}</span>
                </div>
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
            Back
          </Button>
          <MutationStatusButton
            onClick={() => void handleSubmit()}
            mutation={createMutation}
            className="w-full sm:w-auto"
            disabled={!form.formState.isValid || !numberOfShares || !pricePerShare}
          >
            Submit bid
          </MutationStatusButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlaceBidFormModal;
