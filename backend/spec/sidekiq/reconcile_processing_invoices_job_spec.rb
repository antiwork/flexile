# frozen_string_literal: true

RSpec.describe ReconcileProcessingInvoicesJob do
  describe "#perform" do
    let(:wise_credential) { create(:wise_credential) }
    let(:api_service) { instance_double(Wise::PayoutApi) }

    before do
      allow(Wise::PayoutApi).to receive(:new).and_return(api_service)
    end

    context "when a processing invoice has a payment with a wise_transfer_id" do
      let(:invoice) { create(:invoice, :processing) }
      let!(:payment) do
        create(:payment,
               invoice:,
               wise_credential:,
               wise_transfer_id: "12345",
               wise_transfer_status: Payments::Wise::PROCESSING,
               status: Payment::INITIAL)
      end

      before do
        allow(api_service).to receive(:get_transfer).with(transfer_id: "12345").and_return({
          "status" => Payments::Wise::OUTGOING_PAYMENT_SENT,
          "targetValue" => 50.0,
        })
        allow(api_service).to receive(:delivery_estimate).with(transfer_id: "12345").and_return({
          "estimatedDeliveryDate" => "2026-02-14T12:00:00Z",
        })
      end

      it "delegates to InvoicePaymentTransferUpdate" do
        expect(InvoicePaymentTransferUpdate).to receive(:new).with(payment).and_call_original
        described_class.new.perform
      end
    end

    context "when there are no processing invoices" do
      let!(:invoice) { create(:invoice, :paid) }

      it "does not call the Wise API" do
        expect(InvoicePaymentTransferUpdate).not_to receive(:new)
        described_class.new.perform
      end
    end

    context "when the payment has no wise_transfer_id" do
      let(:invoice) { create(:invoice, :processing) }
      let!(:payment) do
        create(:payment,
               invoice:,
               wise_credential:,
               wise_transfer_id: nil,
               status: Payment::INITIAL)
      end

      it "skips the payment" do
        expect(InvoicePaymentTransferUpdate).not_to receive(:new)
        described_class.new.perform
      end
    end

    context "when Wise API raises an error for one invoice" do
      let(:invoice1) { create(:invoice, :processing) }
      let(:invoice2) { create(:invoice, :processing) }
      let!(:payment1) do
        create(:payment,
               invoice: invoice1,
               wise_credential:,
               wise_transfer_id: "11111",
               wise_transfer_status: Payments::Wise::PROCESSING,
               status: Payment::INITIAL)
      end
      let!(:payment2) do
        create(:payment,
               invoice: invoice2,
               wise_credential:,
               wise_transfer_id: "22222",
               wise_transfer_status: Payments::Wise::PROCESSING,
               status: Payment::INITIAL)
      end

      before do
        allow(api_service).to receive(:get_transfer).with(transfer_id: "11111").and_raise(StandardError, "API error")
        allow(api_service).to receive(:get_transfer).with(transfer_id: "22222").and_return({
          "status" => Payments::Wise::OUTGOING_PAYMENT_SENT,
          "targetValue" => 50.0,
        })
        allow(api_service).to receive(:delivery_estimate).with(transfer_id: "22222").and_return({
          "estimatedDeliveryDate" => "2026-02-14T12:00:00Z",
        })
      end

      it "continues processing remaining invoices" do
        described_class.new.perform

        expect(invoice1.reload.status).to eq(Invoice::PROCESSING)
        expect(invoice2.reload.status).to eq(Invoice::PAID)
      end
    end
  end
end
