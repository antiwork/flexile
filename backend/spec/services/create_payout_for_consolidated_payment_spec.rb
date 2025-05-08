# frozen_string_literal: true

RSpec.describe CreatePayoutForConsolidatedPayment, :vcr do
  let(:consolidated_payment) do
    create(:consolidated_payment, stripe_payment_intent_id:, trigger_payout_after: 1.day.ago)
  end

  describe "#perform!" do
    let(:successful_stripe_payment_intent_id) { "pi_3LaEP8FSsGLfTpet1eJw3aVf" }

    context "when the charge is not ready for payout yet" do
      let(:stripe_payment_intent_id) { successful_stripe_payment_intent_id }

      before do
        consolidated_payment.update!(trigger_payout_after: 1.day.from_now)
      end

      it "raises an error" do
        expect do
          described_class.new(consolidated_payment).perform!
        end.to raise_error(CreatePayoutForConsolidatedPayment::Error, "Not ready for payout yet")
      end
    end

    context "when the charge is refunded" do
      let(:stripe_payment_intent_id) { "pi_3LaxpEFSsGLfTpet1kt92iEY" }

      it "raises an error" do
        expect do
          described_class.new(consolidated_payment).perform!
        end.to raise_error(CreatePayoutForConsolidatedPayment::Error, "Stripe charge has been refunded")
      end
    end

    context "when the charge is disputed" do
      let(:stripe_payment_intent_id) { "pi_3LaEP8FSsGLfTpet1eJw3aVf" }

      before do
        # Disputes cannot be triggered on Stripe sandbox so we emulate it
        disputed_payment_intent = Stripe::PaymentIntent.retrieve(id: "pi_3LaEP8FSsGLfTpet1eJw3aVf", expand: ["latest_charge"])
        disputed_payment_intent.latest_charge.disputed = true
        expect(Stripe::PaymentIntent).to receive(:retrieve)
          .with(id: "pi_3LaEP8FSsGLfTpet1eJw3aVf", expand: ["latest_charge"])
          .and_return(disputed_payment_intent)
      end

      it "raises an error" do
        expect do
          described_class.new(consolidated_payment).perform!
        end.to raise_error(CreatePayoutForConsolidatedPayment::Error, "Stripe charge has been disputed")
      end
    end

    context "when the charge is successful" do
      let(:stripe_payment_intent_id) { successful_stripe_payment_intent_id }
      let(:consolidated_invoice) { consolidated_payment.consolidated_invoice }

      it "creates a Stripe Payout and saves the Payout ID for a Stripe payment with money available to be paid out" do
        expect(Stripe::Payout).to receive(:create).with({
          amount: consolidated_invoice.transfer_fee_cents + consolidated_invoice.invoice_amount_cents,
          currency: "usd",
          description: "Flexile Consolidated Invoice #{consolidated_invoice.id}",
          statement_descriptor: "Flexile",
          metadata: {
            consolidated_invoice: consolidated_invoice.id,
            consolidated_payment: consolidated_payment.id,
          },
        }).and_call_original

        expect do
          described_class.new(consolidated_payment).perform!
        end.to change { consolidated_payment.reload.stripe_payout_id.present? }.from(false).to(true)
      end
    end
  end
end
