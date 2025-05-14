# frozen_string_literal: true

RSpec.describe RejectInvoice do
  let(:invoice) { create(:invoice) }
  let(:rejected_by) { create(:user) }
  let(:reason) { "Invoice is incorrect" }

  subject(:service) { described_class.new(invoice:, rejected_by:, reason:) }

  describe "#perform" do
    it "updates the invoice status to rejected" do
      expect { service.perform }.to change { invoice.reload.status }.to(Invoice::REJECTED)
    end

    it "sets the rejected_by user" do
      expect { service.perform }.to change { invoice.reload.rejected_by }.to(rejected_by)
    end

    it "sets the rejection reason" do
      expect { service.perform }.to change { invoice.reload.rejection_reason }.to(reason)
    end

    it "sets the rejected_at timestamp" do
      freeze_time do
        expect { service.perform }.to change { invoice.reload.rejected_at }.to(Time.current)
      end
    end

    context "without a reason" do
      let(:reason) { nil }

      it "rejects the invoice" do
        expect { service.perform }.to change { invoice.reload.status }.to(Invoice::REJECTED)
      end
    end

    it "sends an invoice rejected email" do
      expect(CompanyWorkerMailer).to receive(:invoice_rejected).with(invoice_id: invoice.id, reason: reason).and_return(double(deliver_later: true))
      service.perform
    end

    context "when the invoice has a status that denies rejection" do
      it "does not update the status" do
        RejectInvoice::INVOICE_STATUSES_THAT_DENY_REJECTION.each do |status|
          invoice.update!(status:)
          expect { service.perform }.not_to change { invoice.reload.status }
        end
      end
    end
  end
end
