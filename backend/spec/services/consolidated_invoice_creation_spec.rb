# frozen_string_literal: true

RSpec.describe ConsolidatedInvoiceCreation do
  let(:company) { create(:company) }

  describe "#process" do
    context "when the company is inactive" do
      before do
        allow_any_instance_of(Company).to receive(:active?).and_return(false)
      end

      it "raises an error" do
        expect do
          described_class.new(company_id: company.id).process
        end.to raise_error("Should not generate consolidated invoice for company #{company.id}")
      end
    end

    context "when no invoices fit the criteria" do
      it "does not create a consolidated invoice if no invoices fit the criteria" do
        expect do
          expect(described_class.new(company_id: company.id).process).to eq([])
        end.to change(ConsolidatedInvoice, :count).by(0)
      end
    end

    context "when multiple invoices fit the criteria" do
      before do
        # insufficient approvals
        create(:invoice, company:)
        create(:invoice, :partially_approved, company:)

        # paid or pending payment states but already charged
        invoices = Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, company:, status: _1) }
        create(:consolidated_invoice, invoices:)

        # other ignored states
        create(:invoice, :rejected, company:)
      end

      let!(:paid_or_pending_payment_not_charged) do
        Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, user: create(:user, :contractor), company:, invoice_date: Date.parse("2020-10-10"), status: _1) }
      end
      let!(:fully_approved_failed_invoices) do
        create_list(:invoice, 2, :failed, invoice_date: Date.parse("2020-10-01"), company:)
      end
      let!(:fully_approved_invoices) do
        user = create(:user, :contractor)
        [
          create(:invoice_with_equity, :fully_approved, user:, invoice_date: Date.parse("2020-10-10"), company:),
          create(:invoice_with_equity, :fully_approved, user:, invoice_date: Date.parse("2019-11-11"), company:),
          create(:invoice_with_equity, :fully_approved, user:, invoice_date: Date.parse("2023-12-12"), company:),
        ]
      end
      let(:chargeable_invoices) { paid_or_pending_payment_not_charged + fully_approved_invoices + fully_approved_failed_invoices }
      let(:total_invoiced_cents) { chargeable_invoices.sum(&:cash_amount_in_cents) }
      let(:flexile_fee_cents) { chargeable_invoices.sum(&:flexile_fee_cents) }

      it "creates consolidated invoices grouped by day for all approved, paid, or pending payment invoices that are not yet associated with a consolidated invoice" do
        expect do
          result = described_class.new(company_id: company.id).process
          expect(result).to be_kind_of(Array)
          expect(result.length).to eq(4) # 4 different invoice dates: 2020-10-01, 2020-10-10, 2019-11-11, 2023-12-12
        end.to change(ConsolidatedInvoice, :count).by(4)
          .and change(ConsolidatedInvoicesInvoice, :count).by(chargeable_invoices.size)

        # Verify each consolidated invoice has matching period dates and correct invoices
        consolidated_invoices = ConsolidatedInvoice.last(4)

        # Group expected invoices by date
        invoices_by_date = chargeable_invoices.group_by(&:invoice_date)

        consolidated_invoices.each do |consolidated_invoice|
          invoice_date = consolidated_invoice.period_start_date
          expected_invoices = invoices_by_date[invoice_date]

          expect(consolidated_invoice.status).to eq ConsolidatedInvoice::SENT
          expect(consolidated_invoice.period_start_date).to eq(invoice_date)
          expect(consolidated_invoice.period_end_date).to eq(invoice_date)
          expect(consolidated_invoice.company_id).to eq(company.id)
          expect(consolidated_invoice.invoice_date).to eq(Date.current)
          expect(consolidated_invoice.invoices).to match_array(expected_invoices)

          expected_amount = expected_invoices.sum(&:cash_amount_in_cents)
          expected_fee = expected_invoices.sum(&:flexile_fee_cents)
          expect(consolidated_invoice.invoice_amount_cents).to eq(expected_amount)
          expect(consolidated_invoice.flexile_fee_cents).to eq(expected_fee)
          expect(consolidated_invoice.total_cents).to eq(expected_amount + expected_fee)
        end

        # Updates status on approved or failed invoices but not paid or pending payment invoices
        (fully_approved_invoices + fully_approved_failed_invoices).each do |invoice|
          expect(invoice.reload.status).to eq(Invoice::PAYMENT_PENDING)
        end
        expect(paid_or_pending_payment_not_charged.map(&:reload).map(&:status)).to match_array(Invoice::PAID_OR_PAYING_STATES)
      end
    end

    context "when invoices are provided" do
      let!(:already_charged) do
        invoices = Invoice::PAID_OR_PAYING_STATES.map { create(:invoice, company:, status: _1) }
        create(:consolidated_invoice, invoices:)
        invoices
      end
      let!(:fully_approved_invoices) do
        [
          create(:invoice_with_equity, :fully_approved, invoice_date: Date.parse("2020-10-10"), company:),
          create(:invoice_with_equity, :fully_approved, invoice_date: Date.parse("2019-11-11"), company:),
        ]
      end
      let(:total_invoiced_cents) { fully_approved_invoices.sum(&:cash_amount_in_cents) }
      let(:flexile_fee_cents) { fully_approved_invoices.sum(&:flexile_fee_cents) }

      it "creates consolidated invoices grouped by day for the provided invoices that are not yet associated with a consolidated invoice" do
        expect do
          result = described_class.new(company_id: company.id, invoice_ids: (fully_approved_invoices + already_charged).map(&:id)).process
          expect(result).to be_kind_of(Array)
          expect(result.length).to eq(2) # 2 different invoice dates: 2019-11-11, 2020-10-10
        end.to change(ConsolidatedInvoice, :count).by(2)
          .and change(ConsolidatedInvoicesInvoice, :count).by(fully_approved_invoices.size)

        # Verify each consolidated invoice has matching period dates
        consolidated_invoices = ConsolidatedInvoice.last(2)
        invoices_by_date = fully_approved_invoices.group_by(&:invoice_date)

        consolidated_invoices.each do |consolidated_invoice|
          invoice_date = consolidated_invoice.period_start_date
          expected_invoices = invoices_by_date[invoice_date]

          expect(consolidated_invoice.status).to eq ConsolidatedInvoice::SENT
          expect(consolidated_invoice.period_start_date).to eq(invoice_date)
          expect(consolidated_invoice.period_end_date).to eq(invoice_date)
          expect(consolidated_invoice.company_id).to eq(company.id)
          expect(consolidated_invoice.invoice_date).to eq(Date.current)
          expect(consolidated_invoice.invoices).to match_array(expected_invoices)

          expected_amount = expected_invoices.sum(&:cash_amount_in_cents)
          expected_fee = expected_invoices.sum(&:flexile_fee_cents)
          expect(consolidated_invoice.invoice_amount_cents).to eq(expected_amount)
          expect(consolidated_invoice.flexile_fee_cents).to eq(expected_fee)
          expect(consolidated_invoice.total_cents).to eq(expected_amount + expected_fee)
        end

        # Updates status on provided, eligible invoices
        fully_approved_invoices.each do |invoice|
          expect(invoice.reload.status).to eq(Invoice::PAYMENT_PENDING)
        end
        expect(already_charged.map(&:reload).map(&:status)).to match_array(Invoice::PAID_OR_PAYING_STATES)
      end
    end
  end
end
