# frozen_string_literal: true

RSpec.describe InvoiceEquityCalculator do
  let(:company) { create(:company, equity_compensation_enabled: true, fmv_per_share_in_usd: 1.0) }
  let(:company_worker) { create(:company_worker, company: company, equity_percentage: 20) }
  let(:service_amount_cents) { 1000_00 }
  let(:invoice_year) { Date.current.year }

  subject(:calculator) { described_class.new(company_worker: company_worker, company: company, service_amount_cents: service_amount_cents, invoice_year: invoice_year) }

  describe "#calculate" do
    context "when equity compensation is enabled" do
      it "calculates equity amount correctly" do
        result = calculator.calculate

        expect(result[:equity_cents]).to eq(200_00)
        expect(result[:equity_options]).to eq(200)
        expect(result[:selected_percentage]).to eq(20)
        expect(result[:equity_percentage]).to eq(20)
      end

      context "when equity percentage is 0" do
        let(:company_worker) { create(:company_worker, company: company, equity_percentage: 0) }

        it "returns zero equity amounts" do
          result = calculator.calculate

          expect(result[:equity_cents]).to eq(0)
          expect(result[:equity_options]).to eq(0)
          expect(result[:selected_percentage]).to eq(0)
          expect(result[:equity_percentage]).to eq(0)
        end
      end

      context "when equity percentage is nil" do
        let(:company_worker) { create(:company_worker, company: company, equity_percentage: nil) }

        it "returns zero equity amounts" do
          result = calculator.calculate

          expect(result[:equity_cents]).to eq(0)
          expect(result[:equity_options]).to eq(0)
          expect(result[:selected_percentage]).to eq(0)
          expect(result[:equity_percentage]).to eq(0)
        end
      end
    end

    context "when equity compensation is disabled" do
      let(:company) { create(:company, equity_compensation_enabled: false) }

      it "returns zero equity amounts" do
        result = calculator.calculate

        expect(result[:equity_cents]).to eq(0)
        expect(result[:equity_options]).to eq(0)
        expect(result[:selected_percentage]).to eq(0)
        expect(result[:equity_percentage]).to eq(0)
      end
    end

    context "when share price is not available" do
      let(:company) { create(:company, equity_compensation_enabled: true, fmv_per_share_in_usd: nil) }

      it "returns nil" do
        result = calculator.calculate

        expect(result).to be_nil
      end
    end

    context "when unvested grant is available" do
      let(:company_investor) { create(:company_investor, company: company, user: company_worker.user) }
      let!(:equity_grant) do
        create(:equity_grant, company_investor: company_investor, share_price_usd: 2.0, vesting_trigger: "invoice_paid", unvested_shares: 200, number_of_shares: 200, vested_shares: 0, exercised_shares: 0, forfeited_shares: 0)
      end

      it "uses the grant's share price" do
        result = calculator.calculate
        expect(result[:equity_options]).to eq(200) # 20000 cents / (2.0 * 100) = 200
      end
    end

    context "when unvested shares are insufficient" do
      let(:company_investor) { create(:company_investor, company: company, user: company_worker.user) }
      let!(:equity_grant) do
        create(:equity_grant, company_investor: company_investor, unvested_shares: 50, number_of_shares: 50, vested_shares: 0, exercised_shares: 0, forfeited_shares: 0, vesting_trigger: "invoice_paid")
      end

      it "updates the company worker's equity percentage" do
        calculator.calculate
        expect(company_worker.reload.equity_percentage).to eq(20)
      end
    end
  end
end
