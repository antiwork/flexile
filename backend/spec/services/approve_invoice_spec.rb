# frozen_string_literal: true

RSpec.describe ApproveInvoice do
  let(:invoice) { create(:invoice) }
  let(:approver) { create(:company_administrator, company: invoice.company).user }
  let(:service) { described_class.new(invoice: invoice, approver: approver) }

  describe "#perform" do
    describe "recording approval" do
      it "creates an invoice approval" do
        expect { service.perform }.to change { invoice.invoice_approvals.count }.by(1)
      end

      it "updates the invoice status to approved" do
        expect do
          service.perform
        end.to change { invoice.reload.status }.from(Invoice::RECEIVED).to(Invoice::APPROVED)
      end

      context "when the invoice has a status that denies approval" do
        it "does not update the status" do
          ApproveInvoice::INVOICE_STATUSES_THAT_DENY_APPROVAL.each do |status|
            invoice.update!(status:)
            expect { service.perform }.not_to change { invoice.reload.status }
          end
        end
      end
    end

    describe "sending email" do
      context "when invoice is fully approved and company is active" do
        before do
          allow(invoice).to receive(:fully_approved?).and_return(true)
          allow(invoice.company).to receive(:active?).and_return(true)
        end

        it "sends an invoice approved email" do
          expect do
            service.perform
          end.to have_enqueued_mail(CompanyWorkerMailer, :invoice_approved).with(invoice_id: invoice.id)
        end
      end

      context "when invoice is not fully approved" do
        before do
          allow(invoice).to receive(:fully_approved?).and_return(false)
        end

        it "does not send an invoice approved email" do
          expect do
            service.perform
          end.not_to have_enqueued_mail(CompanyWorkerMailer, :invoice_approved)
        end
      end

      context "when company is not active" do
        before do
          allow(invoice.company).to receive(:active?).and_return(false)
        end

        it "does not send an invoice approved email" do
          expect do
            service.perform
          end.not_to have_enqueued_mail(CompanyWorkerMailer, :invoice_approved)
        end
      end
    end
  end
end
