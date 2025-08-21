# frozen_string_literal: true

RSpec.describe CreateDividendRound do
  let(:company) { create(:company, equity_enabled: true) }
  let(:company_investor) { create(:company_investor, company: company) }
  let(:dividend_computation) { create(:dividend_computation, company: company) }
  let(:dividend_computation_output) do
    create(:dividend_computation_output,
           dividend_computation: dividend_computation,
           company_investor: company_investor,
           share_class: "Common",
           number_of_shares: 100,
           preferred_dividend_amount_in_usd: 0,
           dividend_amount_in_usd: 1000,
           qualified_dividend_amount_usd: 0,
           total_amount_in_usd: 1000)
  end
  let(:service) { described_class.new(dividend_computation) }

  describe "#process" do
    context "when dividend computation has valid data" do
      before do
        dividend_computation_output
      end

      it "successfully generates dividends and marks computation as finalized" do
        result = service.process
        dividend_computation.reload

        expect(dividend_computation.finalized_at).to be_present
        expect(result[:success]).to be true
        expect(result[:dividend_round]).to be_present
      end
    end

    context "when dividend computation is already finalized" do
      it "prevents processing and returns error" do
        dividend_computation.mark_as_finalized!
        result = service.process

        expect(result[:success]).to be false
        expect(result[:error]).to include("already finalized")
      end
    end

    context "when unexpected errors occur" do
      before do
        dividend_computation_output
      end

      it "rolls back transaction when database operation fails" do
        allow(dividend_computation).to receive(:mark_as_finalized!).and_raise("Database connection failed")
        result = service.process
        dividend_computation.reload

        expect(dividend_computation.finalized_at).to be_nil
        expect(result[:success]).to be false
        expect(result[:error]).to include("Database connection failed")
      end
    end
  end
end
