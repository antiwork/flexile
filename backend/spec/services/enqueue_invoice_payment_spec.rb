# frozen_string_literal: true

RSpec.describe EnqueueInvoicePayment do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:contractor) { create(:company_worker, company:).user }
    let(:invoice) { create(:invoice, company:, user: contractor) }
    let(:service) { described_class.new(invoice:) }

    context "when invoice is immediately payable" do
      before do
        allow(invoice).to receive(:immediately_payable?).and_return(true)
      end

      it "updates the invoice status to payment pending" do
        expect { service.perform }.to change { invoice.reload.status }.to(Invoice::PAYMENT_PENDING)
      end

      it "enqueues a PayInvoiceJob" do
        service.perform
        expect(PayInvoiceJob).to have_enqueued_sidekiq_job(invoice.id)
      end
    end

    context "when invoice is not immediately payable" do
      before do
        allow(invoice).to receive(:immediately_payable?).and_return(false)
      end

      it "does not update the invoice status" do
        expect { service.perform }.not_to change { invoice.reload.status }
      end

      it "does not enqueue a PayInvoiceJob" do
        service.perform
        expect(PayInvoiceJob).not_to have_enqueued_sidekiq_job
      end
    end
  end
end
