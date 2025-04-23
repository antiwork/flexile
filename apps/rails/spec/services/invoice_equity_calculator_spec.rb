# frozen_string_literal: true

RSpec.describe InvoiceEquityCalculator do
  let(:company_worker) { create(:company_worker, company:, equity_percentage:) }
  let(:investor) { create(:company_investor, company:, user: company_worker.user) }
  let(:company) { create(:company) }
  let(:service_amount_cents) { 720_37 }
  let(:invoice_year) { Date.current.year }
  let(:share_price_usd) { 2.34 }
  let(:equity_percentage) { 10 }
  let!(:equity_grant) do
    create(:active_grant, company_investor: investor, share_price_usd:, year: Date.current.year)
  end

  subject(:calculator) { described_class.new(company_worker:, company:, service_amount_cents:, invoice_year:) }

  context "when equity compensation is enabled" do
    before do
      company.update!(equity_compensation_enabled: true)
    end

    context "and company_worker has equity percentage" do
      let(:equity_percentage) { 60 }

      it "calculates equity amount in cents and options correctly" do
        company_worker.equity_allocation_for(invoice_year).update!(locked: true)

        result = calculator.calculate
        expect(result[:equity_cents]).to eq(432_22) # (60% of $720.37).round
        expect(result[:equity_options]).to eq(185) # ($432.22/ $2.34).round
        expect(result[:equity_percentage]).to eq(60)
        expect(result[:is_equity_allocation_locked]).to eq(true)
        expect(result[:selected_percentage]).to eq(60)
      end
    end

    context "and computed equity component is too low to make up a whole share" do
      let(:equity_percentage) { 1 }
      let(:share_price_usd) { 14.90 }

      it "returns zero for all equity values" do
        result = calculator.calculate

        # Equity portion = $720 * 1% = $7.20
        # Shares = $7.20 / $14.9 = 0.4832214765100671 = 0 (rounded)
        # Don't allocate any portion to equity as the number of shares comes to 0
        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
        expect(result[:is_equity_allocation_locked]).to eq(false)
        expect(result[:selected_percentage]).to eq(1)
      end
    end

    context "but company_worker does not have equity percentage" do
      let(:equity_percentage) { nil }

      it "returns zero equity values" do
        result = calculator.calculate
        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
        expect(result[:is_equity_allocation_locked]).to eq(nil)
        expect(result[:selected_percentage]).to eq(nil)
      end
    end

    context "and an eligible unvested equity grant for the year is absent" do
      let(:invoice_year) { Date.current.year + 2 }

      before do
        create(:equity_allocation, company_worker: company_worker, equity_percentage: 1, year: invoice_year)
      end

      it "returns zero for all equity values" do
        result = calculator.calculate
        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
        expect(result[:selected_percentage]).to eq(1)
        expect(result[:is_equity_allocation_locked]).to eq(false)
      end

      context "and the company does not have a share price" do
        before do
          company.update!(fmv_per_share_in_usd: nil)
        end

        it "notifies about the missing share price and returns nil" do
          message = "InvoiceEquityCalculator: Error determining share price for CompanyWorker #{company_worker.id}"
          expect(Bugsnag).to receive(:notify).with(message)

          expect(calculator.calculate).to be_nil
        end
      end
    end
  end

  context "when equity compensation is not enabled" do
    it "returns zero equity values" do
      result = calculator.calculate
      expect(result[:equity_cents]).to eq(0)
      expect(result[:equity_options]).to eq(0)
      expect(result[:equity_percentage]).to eq(0)
      expect(result[:is_equity_allocation_locked]).to eq(nil)
      expect(result[:selected_percentage]).to eq(nil)
    end
  end
end
