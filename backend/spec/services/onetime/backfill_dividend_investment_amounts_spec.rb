# frozen_string_literal: true

RSpec.describe Onetime::BackfillDividendInvestmentAmounts do
  let(:company) { create(:company) }

  describe ".perform" do
    context "with share holders only (e.g. Pylon)" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 1.month.ago,
               number_of_shares: 100,
               total_amount_in_cents: 50_000_00)
      end
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               investment_amount_cents: nil,
               total_amount_in_cents: 1_000_00)
      end

      it "sets investment_amount_cents from share_holdings" do
        described_class.perform(dry_run: false)
        expect(dividend.reload.investment_amount_cents).to eq(50_000_00)
      end
    end

    context "with convertible holders only (e.g. Drink LMNT, Austin Flipsters, Fierce)" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:convertible_security) do
        create(:convertible_security,
               company_investor:,
               issued_at: 1.month.ago,
               principal_value_in_cents: 25_000_00)
      end
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end

      it "sets investment_amount_cents from convertible_securities" do
        described_class.perform(dry_run: false)
        expect(dividend.reload.investment_amount_cents).to eq(25_000_00)
      end
    end

    context "with both share holders and convertible holders (e.g. Gumroad)" do
      let(:share_investor) { create(:company_investor, company:) }
      let(:convertible_investor) { create(:company_investor, company:) }
      let(:both_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:share_holding) do
        create(:share_holding,
               company_investor: share_investor,
               issued_at: 1.month.ago,
               number_of_shares: 200,
               total_amount_in_cents: 100_000_00)
      end
      let!(:convertible_security) do
        create(:convertible_security,
               company_investor: convertible_investor,
               issued_at: 1.month.ago,
               principal_value_in_cents: 10_000_00)
      end
      let!(:both_share_holding) do
        create(:share_holding,
               company_investor: both_investor,
               issued_at: 1.month.ago,
               number_of_shares: 50,
               total_amount_in_cents: 25_000_00)
      end
      let!(:both_convertible_security) do
        create(:convertible_security,
               company_investor: both_investor,
               issued_at: 1.month.ago,
               principal_value_in_cents: 5_000_00)
      end

      let!(:share_dividend) do
        create(:dividend,
               company:,
               company_investor: share_investor,
               dividend_round:,
               number_of_shares: 200,
               investment_amount_cents: nil,
               total_amount_in_cents: 2_000_00)
      end
      let!(:convertible_dividend) do
        create(:dividend,
               company:,
               company_investor: convertible_investor,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 200_00)
      end
      # Investor with both shares and convertibles gets TWO dividends per round
      let!(:both_shares_dividend) do
        create(:dividend,
               company:,
               company_investor: both_investor,
               dividend_round:,
               number_of_shares: 50,
               investment_amount_cents: nil,
               total_amount_in_cents: 300_00)
      end
      let!(:both_convertible_dividend) do
        create(:dividend,
               company:,
               company_investor: both_investor,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 200_00)
      end

      it "sets investment_amount_cents correctly for each type" do
        described_class.perform(dry_run: false)

        expect(share_dividend.reload.investment_amount_cents).to eq(100_000_00)
        expect(convertible_dividend.reload.investment_amount_cents).to eq(10_000_00)
        expect(both_shares_dividend.reload.investment_amount_cents).to eq(25_000_00)
        expect(both_convertible_dividend.reload.investment_amount_cents).to eq(5_000_00)
      end
    end

    context "with multiple share holdings and convertible securities per investor" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:share_holding_1) do
        create(:share_holding,
               company_investor:,
               issued_at: 6.months.ago,
               number_of_shares: 100,
               total_amount_in_cents: 10_000_00)
      end
      let!(:share_holding_2) do
        create(:share_holding,
               company_investor:,
               issued_at: 3.months.ago,
               number_of_shares: 50,
               total_amount_in_cents: 7_500_00)
      end
      let!(:convertible_security_1) do
        create(:convertible_security,
               company_investor:,
               issued_at: 6.months.ago,
               principal_value_in_cents: 5_000_00)
      end
      let!(:convertible_security_2) do
        create(:convertible_security,
               company_investor:,
               issued_at: 3.months.ago,
               principal_value_in_cents: 3_000_00)
      end

      let!(:shares_dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: 150,
               investment_amount_cents: nil,
               total_amount_in_cents: 1_000_00)
      end
      let!(:convertible_dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end

      it "sums all share holdings for shares dividend and all convertibles for convertible dividend" do
        described_class.perform(dry_run: false)
        expect(shares_dividend.reload.investment_amount_cents).to eq(17_500_00)
        expect(convertible_dividend.reload.investment_amount_cents).to eq(8_000_00)
      end
    end

    context "only includes holdings issued before the dividend round" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 2.months.ago) }

      let!(:old_share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 6.months.ago,
               number_of_shares: 100,
               total_amount_in_cents: 10_000_00)
      end
      let!(:new_share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 1.month.ago,
               number_of_shares: 200,
               total_amount_in_cents: 20_000_00)
      end
      let!(:old_convertible) do
        create(:convertible_security,
               company_investor:,
               issued_at: 6.months.ago,
               principal_value_in_cents: 5_000_00)
      end
      let!(:new_convertible) do
        create(:convertible_security,
               company_investor:,
               issued_at: 1.month.ago,
               principal_value_in_cents: 8_000_00)
      end

      let!(:shares_dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: 100,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end
      let!(:convertible_dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               investment_amount_cents: nil,
               total_amount_in_cents: 300_00)
      end

      it "only includes holdings issued before the dividend round" do
        described_class.perform(dry_run: false)
        expect(shares_dividend.reload.investment_amount_cents).to eq(10_000_00)
        expect(convertible_dividend.reload.investment_amount_cents).to eq(5_000_00)
      end
    end

    context "skips dividend rounds 9 and 12" do
      let(:dividend_round_9) { create(:dividend_round, id: 9, company:, issued_at: 1.day.ago) }
      let(:dividend_round_12) { create(:dividend_round, id: 12, company:, issued_at: 1.day.ago) }
      let(:company_investor) { create(:company_investor, company:) }

      let!(:convertible_security) do
        create(:convertible_security,
               company_investor:,
               issued_at: 1.month.ago,
               principal_value_in_cents: 10_000_00)
      end

      let!(:dividend_in_round_9) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round: dividend_round_9,
               investment_amount_cents: nil,
               total_amount_in_cents: 100_00)
      end
      let!(:dividend_in_round_12) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round: dividend_round_12,
               investment_amount_cents: nil,
               total_amount_in_cents: 200_00)
      end

      it "does not update dividends in skipped rounds" do
        described_class.perform(dry_run: false)
        expect(dividend_in_round_9.reload.investment_amount_cents).to be_nil
        expect(dividend_in_round_12.reload.investment_amount_cents).to be_nil
      end
    end

    context "skips dividends that already have investment_amount_cents" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 1.month.ago,
               number_of_shares: 100,
               total_amount_in_cents: 50_000_00)
      end

      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               investment_amount_cents: 99_999_00,
               total_amount_in_cents: 1_000_00)
      end

      it "does not overwrite existing investment_amount_cents" do
        described_class.perform(dry_run: false)
        expect(dividend.reload.investment_amount_cents).to eq(99_999_00)
      end
    end

    context "when calculated investment is zero" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               investment_amount_cents: nil,
               total_amount_in_cents: 100_00)
      end

      it "still updates investment_amount_cents to zero with a warning" do
        described_class.perform(dry_run: false)
        expect(dividend.reload.investment_amount_cents).to eq(0)
      end
    end

    context "handles investment_amount_cents set to 0 (local DB NOT NULL constraint)" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 1.month.ago,
               number_of_shares: 100,
               total_amount_in_cents: 50_000_00)
      end

      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               investment_amount_cents: 0,
               total_amount_in_cents: 1_000_00)
      end

      it "backfills dividends with investment_amount_cents of 0" do
        described_class.perform(dry_run: false)
        expect(dividend.reload.investment_amount_cents).to eq(50_000_00)
      end
    end

    context "dry run mode" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 1.month.ago,
               number_of_shares: 100,
               total_amount_in_cents: 50_000_00)
      end

      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               investment_amount_cents: nil,
               total_amount_in_cents: 1_000_00)
      end

      it "does not update any records" do
        described_class.perform(dry_run: true)
        expect(dividend.reload.investment_amount_cents).to be_nil
      end
    end

    context "with multiple dividend rounds for the same company" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:round_1) { create(:dividend_round, company:, issued_at: 6.months.ago) }
      let(:round_2) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:old_share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 1.year.ago,
               number_of_shares: 100,
               total_amount_in_cents: 10_000_00)
      end
      let!(:new_share_holding) do
        create(:share_holding,
               company_investor:,
               issued_at: 3.months.ago,
               number_of_shares: 200,
               total_amount_in_cents: 30_000_00)
      end

      let!(:dividend_round_1) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round: round_1,
               investment_amount_cents: nil,
               total_amount_in_cents: 500_00)
      end
      let!(:dividend_round_2) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round: round_2,
               investment_amount_cents: nil,
               total_amount_in_cents: 1_000_00)
      end

      it "calculates correct historical investment amount for each round" do
        described_class.perform(dry_run: false)

        expect(dividend_round_1.reload.investment_amount_cents).to eq(10_000_00)
        expect(dividend_round_2.reload.investment_amount_cents).to eq(40_000_00)
      end
    end
  end
end
