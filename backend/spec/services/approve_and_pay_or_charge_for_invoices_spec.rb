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
  let!(:non_payable) do
    [
      create(:invoice, company:),
      create(:invoice, :rejected, company:),
    ]
  end
  let!(:paid_or_pending_payment_not_charged) do
    Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, company:, status: _1) }
  end
  let!(:fully_approved) { create_list(:invoice, 2, :fully_approved, company:) }
  let(:payable_and_chargeable) { fully_approved + missing_final_approval + failed_but_not_charged }
  let(:invoices) do
    payable_and_chargeable +
    already_charged_but_failed +
    non_payable
  end

  it "approves all invoices, pays failed invoices, and generates a consolidated invoice for chargeable invoices" do
    # approves all invoices
    invoices.each do |invoice|
      expect(ApproveInvoice).to receive(:new).with(invoice:, approver: user).and_call_original
    end

    # pays for failed but payable invoices
    already_charged_but_failed.each do |invoice|
      expect(EnqueueInvoicePayment).to receive(:new).with(invoice:).and_call_original
    end

    # creates a consolidated invoice for the chargeable invoices
    expect(ConsolidatedInvoiceCreation).to receive(:new).with(company_id: company.id, invoice_ids: payable_and_chargeable.map(&:id)).and_call_original

    consolidated_invoice = described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform

    # charges for the consolidated invoice
    expect(ChargeConsolidatedInvoiceJob).to have_enqueued_sidekiq_job(consolidated_invoice.id)
  end

  describe "paying failed invoices" do
    context "when company is trusted" do
      before { company.update!(is_trusted: true) }

      it "pays the invoices immediately even if the consolidated invoice has not yet been paid" do
        consolidated_invoice.update!(status: ConsolidatedInvoice::SENT)
        expect(ConsolidatedInvoiceCreation).to receive(:new).with(company_id: company.id, invoice_ids: payable_and_chargeable.map(&:id)).and_call_original

        described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform

        already_charged_but_failed.each do |invoice|
          expect(PayInvoiceJob).to have_enqueued_sidekiq_job(invoice.id)
        end
      end
    end

    context "when company is not trusted" do
      it "pays the invoices immediately if the consolidated invoice has been paid" do
        expect(ConsolidatedInvoiceCreation).to receive(:new).with(company_id: company.id, invoice_ids: payable_and_chargeable.map(&:id)).and_call_original

        described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform

        already_charged_but_failed.each do |invoice|
          expect(PayInvoiceJob).to have_enqueued_sidekiq_job(invoice.id)
        end
      end

      it "does not pay the invoice immediately if the consolidated invoice has not yet been paid" do
        consolidated_invoice.update!(status: ConsolidatedInvoice::SENT)

        expect do
          described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id)).perform
        end.not_to change { PayInvoiceJob.jobs.size }

        already_charged_but_failed.each do |invoice|
          expect(PayInvoiceJob).not_to have_enqueued_sidekiq_job(invoice.id)
        end
      end
    end

    context "when no invoices are chargeable" do
      it "does not create a consolidated invoice" do
        expect(ConsolidatedInvoiceCreation).not_to receive(:new)

        described_class.new(user:, company:, invoice_ids: already_charged_but_failed.map(&:external_id)).perform
      end
    end
  end

  context "when some invoices do not belong to the company" do
    it "raises a not found error" do
      expect do
        described_class.new(user:, company:, invoice_ids: invoices.map(&:external_id) + [create(:invoice).external_id]).perform
      end.to raise_error ActiveRecord::RecordNotFound
    end
  end
end
