# frozen_string_literal: true

RSpec.describe Onetime::BackfillDividendInvestmentAmounts do
  describe "#perform" do
    subject(:service) { described_class.new }

    let(:company) { create(:company) }
    let(:dividend_round) { create(:dividend_round, company:) }

    context "when dividends are share-based" do
      let(:company_investor) { create(:company_investor, company:, investment_amount_in_cents: 500_00) }

      let!(:dividend) do
        create(:dividend, company:, company_investor:, dividend_round:, number_of_shares: 100).tap do |d|
          d.update_columns(investment_amount_cents: nil)
        end
      end

      it "backfills from company_investor.investment_amount_in_cents" do
        service.perform
        expect(dividend.reload.investment_amount_cents).to eq(500_00)
      end
    end

    context "when dividends are convertible/SAFE-based" do
      let(:company_investor) { create(:company_investor, company:, investment_amount_in_cents: 0) }
      let(:convertible_investment) { create(:convertible_investment, company:) }

      let!(:convertible_security) do
        create(:convertible_security,
               company_investor:,
               convertible_investment:,
               principal_value_in_cents: 250_000_00)
      end

      let!(:dividend) do
        create(:dividend, company:, company_investor:, dividend_round:, number_of_shares: nil).tap do |d|
          d.update_columns(investment_amount_cents: nil)
        end
      end

      it "backfills from convertible_securities.principal_value_in_cents" do
        service.perform
        expect(dividend.reload.investment_amount_cents).to eq(250_000_00)
      end
    end

    context "when dividends already have investment_amount_cents" do
      let(:company_investor) { create(:company_investor, company:, investment_amount_in_cents: 100_00) }

      let!(:dividend) do
        create(:dividend, company:, company_investor:, dividend_round:, investment_amount_cents: 999_99)
      end

      it "does not overwrite existing values" do
        service.perform
        expect(dividend.reload.investment_amount_cents).to eq(999_99)
      end
    end

    context "when a company_investor has no shares or securities" do
      let(:company_investor) { create(:company_investor, company:, investment_amount_in_cents: 0) }

      let!(:dividend) do
        create(:dividend, company:, company_investor:, dividend_round:, number_of_shares: nil).tap do |d|
          d.update_columns(investment_amount_cents: nil)
        end
      end

      it "falls back to 0" do
        service.perform
        expect(dividend.reload.investment_amount_cents).to eq(0)
      end
    end

    context "with multiple dividends across different investors" do
      let(:share_investor) { create(:company_investor, company:, investment_amount_in_cents: 300_00) }
      let(:safe_investor) { create(:company_investor, company:, investment_amount_in_cents: 0) }
      let(:convertible_investment) { create(:convertible_investment, company:) }

      let!(:convertible_security) do
        create(:convertible_security,
               company_investor: safe_investor,
               convertible_investment:,
               principal_value_in_cents: 100_000_00)
      end

      let!(:share_dividend) do
        create(:dividend, company:, company_investor: share_investor, dividend_round:, number_of_shares: 50).tap do |d|
          d.update_columns(investment_amount_cents: nil)
        end
      end

      let!(:safe_dividend) do
        create(:dividend, company:, company_investor: safe_investor, dividend_round:, number_of_shares: nil).tap do |d|
          d.update_columns(investment_amount_cents: nil)
        end
      end

      it "backfills both correctly" do
        service.perform
        expect(share_dividend.reload.investment_amount_cents).to eq(300_00)
        expect(safe_dividend.reload.investment_amount_cents).to eq(100_000_00)
      end
    end
  end
end
