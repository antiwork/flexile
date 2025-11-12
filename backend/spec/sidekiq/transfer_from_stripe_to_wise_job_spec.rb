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

      after do
        Flipper.disable(:transfer_from_stripe_to_wise)
      end

      it "processes eligible consolidated payments" do
        service1 = instance_double(CreatePayoutForConsolidatedPayment)
        service2 = instance_double(CreatePayoutForConsolidatedPayment)

        expect(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment1).and_return(service1)
        expect(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment2).and_return(service2)

        expect(service1).to receive(:perform!)
        expect(service2).to receive(:perform!)

        described_class.new.perform
      end

      it "does not process ineligible consolidated payments" do
        allow(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment1).and_return(instance_double(CreatePayoutForConsolidatedPayment, perform!: true))
        allow(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment2).and_return(instance_double(CreatePayoutForConsolidatedPayment, perform!: true))

        expect(CreatePayoutForConsolidatedPayment).not_to receive(:new).with(ineligible_payment_has_payout)
        expect(CreatePayoutForConsolidatedPayment).not_to receive(:new).with(ineligible_payment_future)

        described_class.new.perform
      end

      it "continues processing even if one payment fails" do
        service1 = instance_double(CreatePayoutForConsolidatedPayment)
        service2 = instance_double(CreatePayoutForConsolidatedPayment)

        allow(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment1).and_return(service1)
        allow(CreatePayoutForConsolidatedPayment).to receive(:new).with(eligible_payment2).and_return(service2)

        allow(service1).to receive(:perform!).and_raise(CreatePayoutForConsolidatedPayment::Error.new("Test error"))
        expect(service2).to receive(:perform!).and_return(true)

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

      it "returns early without querying for eligible records" do
        job = described_class.new
        expect(job).not_to receive(:eligible_records)
        job.perform
      end
    end
  end
end
