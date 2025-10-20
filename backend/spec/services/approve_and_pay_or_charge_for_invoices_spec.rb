# frozen_string_literal: true

RSpec.describe ApproveAndPayOrChargeForInvoices do
  let(:company) { create(:company) }
  let(:user) { create(:company_administrator, company:).user }
  let!(:missing_final_approval) { [create(:invoice, :partially_approved, company:)] }
  let!(:already_charged) do
    invoices = Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, company:, status: _1) }
    create(:consolidated_invoice, invoices:)
    invoices
  end
  let!(:already_charged_but_failed) { create_list(:invoice, 3, :fully_approved, company:, status: Invoice::FAILED) }
  let!(:consolidated_invoice) { create(:consolidated_invoice, invoices: already_charged_but_failed, status: ConsolidatedInvoice::PAID) }
  let!(:failed_but_not_charged) do
    invoices = create_list(:invoice, 2, :fully_approved, company:)
    invoices.map { _1.update(status: Invoice::FAILED) }
    invoices
  end
  let!(:paid_or_pending_payment_not_charged) do
    Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, company:, status: _1) }
  end
  let!(:fully_approved) { create_list(:invoice, 2, :fully_approved, company:) }
  let(:payable_and_chargeable) { fully_approved + missing_final_approval + failed_but_not_charged }
  let(:invoices) do
    payable_and_chargeable +
      already_charged_but_failed
  end

  describe "#perform" do
    it "approves invoices, enqueues payments, creates a consolidated invoice, and returns no deferrals when everything is ready" do
      invoices.each do |invoice|
        expect(ApproveInvoice).to receive(:new).with(invoice:, approver: user).and_call_original
      end

      already_charged_but_failed.each do |invoice|
        expect(EnqueueInvoicePayment).to receive(:new).with(invoice:).and_call_original
      end

      expect(ConsolidatedInvoiceCreation).to receive(:new).with(company_id: company.id, invoice_ids: payable_and_chargeable.map(&:id)).and_call_original

      expect do
        service = described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id))
        consolidated_invoice = service.perform
        expect(service.deferred_invoices).to be_empty
        expect(consolidated_invoice).to be_a(ConsolidatedInvoice)
      end.to change { company.consolidated_invoices.count }.by(1)

      latest_consolidated_invoice = company.consolidated_invoices.order(:created_at).last
      expect(ChargeConsolidatedInvoiceJob).to have_enqueued_sidekiq_job(latest_consolidated_invoice.id)
    end

    context "when the company is trusted" do
      before { company.update!(is_trusted: true) }

      it "retries failed invoices immediately even if the consolidated invoice has not yet been paid" do
        consolidated_invoice.update!(status: ConsolidatedInvoice::SENT)

        described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform

        already_charged_but_failed.each do |invoice|
          expect(PayInvoiceJob).to have_enqueued_sidekiq_job(invoice.id)
        end
      end
    end

    context "when the company is not trusted" do
      it "enqueues payments for failed invoices only after a consolidated invoice is paid" do
        expect(ConsolidatedInvoiceCreation).to receive(:new).with(company_id: company.id, invoice_ids: payable_and_chargeable.map(&:id)).and_call_original

        described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform

        already_charged_but_failed.each do |invoice|
          expect(PayInvoiceJob).to have_enqueued_sidekiq_job(invoice.id)
        end
      end

      it "does not enqueue immediate payments if the consolidated invoice is still pending" do
        consolidated_invoice.update!(status: ConsolidatedInvoice::SENT)

        expect do
          described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform
        end.not_to change { PayInvoiceJob.jobs.size }

        already_charged_but_failed.each do |invoice|
          expect(PayInvoiceJob).not_to have_enqueued_sidekiq_job(invoice.id)
        end
      end
    end

    context "when there are no chargeable invoices" do
      it "skips consolidated invoice creation" do
        expect(ConsolidatedInvoiceCreation).not_to receive(:new)

        described_class.new(user:, company:, invoice_ids: already_charged_but_failed.map(&:external_id)).perform
      end
    end

    context "when an invoice does not belong to the company" do
      it "raises an ActiveRecord::RecordNotFound error" do
        expect do
          described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id) + [create(:invoice).external_id]).perform
        end.to raise_error ActiveRecord::RecordNotFound
      end
    end

    context "when the contractor has not finished onboarding" do
      let(:company) { create(:company, required_invoice_approval_count: 1) }
      let(:admin) { create(:company_administrator, company:).user }
      let(:worker) { create(:company_worker, company:) }
      let(:invoice) do
        create(
          :invoice,
          :approved,
          company:,
          company_worker: worker,
          user: worker.user,
          created_by: admin,
          approvals: 0,
          accepted_at: nil,
        )
      end

      it "returns a deferred payload with a clear message" do
        service = described_class.new(user: admin, company:, invoice_ids: [invoice.external_id])
        service.perform

        expect(service.deferred_invoices).to contain_exactly(
          include(
            invoice_id: invoice.external_id,
            invoice_number: invoice.invoice_number,
            message: a_string_matching(/accept/i),
          ),
        )
      end
    end
  end
end
