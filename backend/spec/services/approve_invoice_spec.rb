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

    describe "equity grant validation" do
      let(:company) { create(:company, equity_enabled: true) }
      let(:company_worker) { create(:company_worker, company: company, equity_percentage: 10) }
      let(:invoice_with_equity) { create(:invoice, company_worker: company_worker, company: company) }
      let(:equity_approver) { create(:company_administrator, company: company).user }
      let(:service_with_equity) { described_class.new(invoice: invoice_with_equity, approver: equity_approver) }

      context "when equity is enabled and contractor has equity percentage but no grant exists" do
        it "raises RecordInvalid with specific error message" do
          expect do
            service_with_equity.perform
          end.to raise_error(ActiveRecord::RecordInvalid, /Admin must create an equity grant before this invoice can be approved/)
        end

        it "does not create an invoice approval" do
          expect do
            service_with_equity.perform rescue nil
          end.not_to change { invoice_with_equity.invoice_approvals.count }
        end

        it "does not update the invoice status" do
          expect do
            service_with_equity.perform rescue nil
          end.not_to change { invoice_with_equity.reload.status }
        end
      end

      context "when contractor has zero equity percentage" do
        let(:company_worker_no_equity) { create(:company_worker, company: company, equity_percentage: 0) }
        let(:invoice_no_equity) { create(:invoice, company_worker: company_worker_no_equity, company: company) }
        let(:no_equity_approver) { create(:company_administrator, company: company).user }
        let(:service_no_equity) { described_class.new(invoice: invoice_no_equity, approver: no_equity_approver) }

        it "approves the invoice normally" do
          expect do
            service_no_equity.perform
          end.to change { invoice_no_equity.reload.status }.from(Invoice::RECEIVED).to(Invoice::APPROVED)
        end
      end

      context "when equity is disabled" do
        let(:company_no_equity) { create(:company, equity_enabled: false) }
        let(:company_worker_disabled) { create(:company_worker, company: company_no_equity, equity_percentage: 10) }
        let(:invoice_disabled) { create(:invoice, company_worker: company_worker_disabled, company: company_no_equity) }
        let(:disabled_approver) { create(:company_administrator, company: company_no_equity).user }
        let(:service_disabled) { described_class.new(invoice: invoice_disabled, approver: disabled_approver) }

        it "approves the invoice normally" do
          expect do
            service_disabled.perform
          end.to change { invoice_disabled.reload.status }.from(Invoice::RECEIVED).to(Invoice::APPROVED)
        end
      end

      context "when equity grant exists but has insufficient shares" do
        let!(:company_investor) { create(:company_investor, company: company, user: company_worker.user) }
        let!(:insufficient_equity_grant) do
          create(:equity_grant,
                 company_investor: company_investor,
                 number_of_shares: 5,
                 vested_shares: 0,
                 unvested_shares: 5,
                 forfeited_shares: 0,
                 exercised_shares: 0,
                 share_price_usd: 1.0,
                 period_ended_at: Date.current.end_of_year)
        end

        it "raises RecordInvalid with specific error message" do
          expect do
            service_with_equity.perform
          end.to raise_error(ActiveRecord::RecordInvalid, /Admin must create an equity grant before this invoice can be approved/)
        end

        it "does not create an invoice approval" do
          expect do
            service_with_equity.perform rescue nil
          end.not_to change { invoice_with_equity.invoice_approvals.count }
        end

        it "does not update the invoice status" do
          expect do
            service_with_equity.perform rescue nil
          end.not_to change { invoice_with_equity.reload.status }
        end
      end

      context "when sufficient equity grant exists" do
        let!(:company_investor) { create(:company_investor, company: company, user: company_worker.user) }
        let!(:equity_grant) do
          create(:equity_grant,
                 company_investor: company_investor,
                 number_of_shares: 1000,
                 vested_shares: 0,
                 unvested_shares: 1000,
                 exercised_shares: 0,
                 forfeited_shares: 0,
                 share_price_usd: 1.0,
                 period_ended_at: Date.current.end_of_year)
        end

        it "approves the invoice normally" do
          expect do
            service_with_equity.perform
          end.to change { invoice_with_equity.reload.status }.from(Invoice::RECEIVED).to(Invoice::APPROVED)
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
