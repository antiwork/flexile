# frozen_string_literal: true

RSpec.describe TransferFromStripeToWiseJob do
  describe "#perform" do
    let!(:eligible_payment1) { create(:consolidated_payment, stripe_payout_id: nil, trigger_payout_after: 1.day.ago) }
    let!(:eligible_payment2) { create(:consolidated_payment, stripe_payout_id: nil, trigger_payout_after: 2.days.ago) }
    let!(:ineligible_payment_has_payout) { create(:consolidated_payment, stripe_payout_id: "po_123", trigger_payout_after: 1.day.ago) }
    let!(:ineligible_payment_future) { create(:consolidated_payment, stripe_payout_id: nil, trigger_payout_after: 1.day.from_now) }

    context "when feature flag is enabled" do
      before do
        Flipper.enable(:transfer_from_stripe_to_wise)
      end

      it "processes eligible consolidated payments" do
        expect(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment1).and_call_original
        expect(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment2).and_call_original
        expect_any_instance_of(CreatePayoutForConsolidatedPayment).to receive(:perform!).twice

        described_class.new.perform
      end

      it "does not process ineligible consolidated payments" do
        expect(CreatePayoutForConsolidatedPayment).not_to receive(:new).with(ineligible_payment_has_payout)
        expect(CreatePayoutForConsolidatedPayment).not_to receive(:new).with(ineligible_payment_future)

        described_class.new.perform
      end

      it "continues processing even if one payment fails" do
        allow_any_instance_of(CreatePayoutForConsolidatedPayment).to receive(:perform!)
          .and_raise(CreatePayoutForConsolidatedPayment::Error.new("Test error"))

        expect { described_class.new.perform }.not_to raise_error
      end
    end

    context "when feature flag is disabled" do
      before do
        Flipper.disable(:transfer_from_stripe_to_wise)
      end

      it "does not process any consolidated payments" do
        expect(CreatePayoutForConsolidatedPayment).not_to receive(:new)

        described_class.new.perform
      end

      it "does not query for eligible records" do
        expect(ConsolidatedPayment).not_to receive(:where)

        described_class.new.perform
      end
    end
  end
end
