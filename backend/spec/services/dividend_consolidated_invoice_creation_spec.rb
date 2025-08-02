# frozen_string_literal: true

RSpec.describe DividendConsolidatedInvoiceCreation do
  describe "#process" do
    let(:company) { create(:company) }
    let(:dividend_round) { create(:dividend_round, company:, total_amount_in_cents: 50_000) }
    let(:service) { described_class.new(dividend_round) }

    context "when company is active and has bank account" do
      before do
        allow(dividend_round).to receive(:flexile_fees_in_cents).and_return(2_000)
      end

      it "creates a consolidated invoice with correct attributes" do
        consolidated_invoice = service.process

        expect(consolidated_invoice).to be_persisted
        expect(consolidated_invoice.company).to eq(company)
        expect(consolidated_invoice.invoice_date).to eq(Date.current)
        expect(consolidated_invoice.invoice_number).to start_with("FX-DIV-")
        expect(consolidated_invoice.status).to eq(ConsolidatedInvoice::SENT)
        expect(consolidated_invoice.period_start_date).to eq(dividend_round.issued_at.to_date)
        expect(consolidated_invoice.period_end_date).to eq(dividend_round.issued_at.to_date)
        expect(consolidated_invoice.invoice_amount_cents).to eq(50_000)
        expect(consolidated_invoice.flexile_fee_cents).to eq(2_000)
        expect(consolidated_invoice.transfer_fee_cents).to eq(0)
        expect(consolidated_invoice.total_cents).to eq(52_000)
      end

      it "associates the consolidated invoice with the dividend round" do
        consolidated_invoice = service.process
        dividend_round.reload

        expect(dividend_round.consolidated_invoice).to eq(consolidated_invoice)
      end

      it "generates correct invoice number based on existing count" do
        create(:consolidated_invoice, company:)
        consolidated_invoice = service.process

        expect(consolidated_invoice.invoice_number).to eq("FX-DIV-2")
      end
    end

    context "when company is not active" do
      let(:company) { create(:company, deactivated_at: 1.day.ago) }

      it "raises an error" do
        expect { service.process }.to raise_error("Should not generate consolidated invoice for company #{company.id}")
      end
    end

    context "when company does not have bank account ready" do
      before do
        allow(company).to receive(:bank_account_ready?).and_return(false)
      end

      it "raises an error" do
        expect { service.process }.to raise_error("Should not generate consolidated invoice for company #{company.id}")
      end
    end
  end
end
