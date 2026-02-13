# frozen_string_literal: true

RSpec.describe Onetime::BackfillImpliedSharesForConvertibleDividends do
  let(:company) { create(:company) }

  describe ".perform" do
    context "with a single convertible security" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:convertible_investment) { create(:convertible_investment, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:convertible_security) do
        create(:convertible_security,
               company_investor:,
               convertible_investment:,
               principal_value_in_cents: 200_000_00,
               implied_shares: 1_000)
      end
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 200_000_00,
               total_amount_in_cents: 500_00)
      end

      it "sets number_of_shares and implied_shares from matching security" do
        described_class.perform(dry_run: false)
        dividend.reload
        expect(dividend.number_of_shares).to eq(1_000)
        expect(dividend.implied_shares).to be true
      end
    end

    context "with multiple convertible securities for the same investor" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:convertible_investment_1) { create(:convertible_investment, company:, amount_in_cents: 200_000_00) }
      let(:convertible_investment_2) { create(:convertible_investment, company:, amount_in_cents: 100_000_00) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }

      let!(:security_1) do
        create(:convertible_security,
               company_investor:,
               convertible_investment: convertible_investment_1,
               principal_value_in_cents: 200_000_00,
               implied_shares: 2_000)
      end
      let!(:security_2) do
        create(:convertible_security,
               company_investor:,
               convertible_investment: convertible_investment_2,
               principal_value_in_cents: 100_000_00,
               implied_shares: 500)
      end

      let!(:dividend_from_security_1) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 200_000_00,
               total_amount_in_cents: 1_000_00)
      end
      let!(:dividend_from_security_2) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 100_000_00,
               total_amount_in_cents: 500_00)
      end

      it "matches each dividend to its specific security by principal_value_in_cents" do
        described_class.perform(dry_run: false)

        dividend_from_security_1.reload
        expect(dividend_from_security_1.number_of_shares).to eq(2_000)
        expect(dividend_from_security_1.implied_shares).to be true

        dividend_from_security_2.reload
        expect(dividend_from_security_2.number_of_shares).to eq(500)
        expect(dividend_from_security_2.implied_shares).to be true
      end
    end

    context "skips dividends that already have number_of_shares" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: 500,
               implied_shares: false,
               total_amount_in_cents: 1_000_00)
      end

      it "does not modify share-based dividends" do
        described_class.perform(dry_run: false)
        dividend.reload
        expect(dividend.number_of_shares).to eq(500)
        expect(dividend.implied_shares).to be false
      end
    end

    context "skips dividends with no matching convertible security" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 999_999_00,
               total_amount_in_cents: 500_00)
      end

      it "does not update the dividend" do
        described_class.perform(dry_run: false)
        dividend.reload
        expect(dividend.number_of_shares).to be_nil
        expect(dividend.implied_shares).to be false
      end
    end

    context "dry run mode" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:convertible_investment) { create(:convertible_investment, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:convertible_security) do
        create(:convertible_security,
               company_investor:,
               convertible_investment:,
               principal_value_in_cents: 200_000_00,
               implied_shares: 1_000)
      end
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 200_000_00,
               total_amount_in_cents: 500_00)
      end

      it "does not update any records" do
        described_class.perform(dry_run: true)
        dividend.reload
        expect(dividend.number_of_shares).to be_nil
        expect(dividend.implied_shares).to be false
      end
    end

    context "with decimal implied_shares on security" do
      let(:company_investor) { create(:company_investor, company:) }
      let(:convertible_investment) { create(:convertible_investment, company:) }
      let(:dividend_round) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let!(:convertible_security) do
        create(:convertible_security,
               company_investor:,
               convertible_investment:,
               principal_value_in_cents: 200_000_00,
               implied_shares: 1_234.56)
      end
      let!(:dividend) do
        create(:dividend,
               company:,
               company_investor:,
               dividend_round:,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 200_000_00,
               total_amount_in_cents: 500_00)
      end

      it "rounds implied_shares to the nearest integer" do
        described_class.perform(dry_run: false)
        dividend.reload
        expect(dividend.number_of_shares).to eq(1_235)
        expect(dividend.implied_shares).to be true
      end
    end

    context "with multiple dividend rounds across companies" do
      let(:company_2) { create(:company) }
      let(:investor_1) { create(:company_investor, company:) }
      let(:investor_2) { create(:company_investor, company: company_2) }
      let(:ci_1) { create(:convertible_investment, company:) }
      let(:ci_2) { create(:convertible_investment, company: company_2) }
      let(:round_1) { create(:dividend_round, company:, issued_at: 1.day.ago) }
      let(:round_2) { create(:dividend_round, company: company_2, issued_at: 1.day.ago) }

      let!(:security_1) do
        create(:convertible_security,
               company_investor: investor_1,
               convertible_investment: ci_1,
               principal_value_in_cents: 50_000_00,
               implied_shares: 800)
      end
      let!(:security_2) do
        create(:convertible_security,
               company_investor: investor_2,
               convertible_investment: ci_2,
               principal_value_in_cents: 75_000_00,
               implied_shares: 1_200)
      end

      let!(:dividend_1) do
        create(:dividend,
               company:,
               company_investor: investor_1,
               dividend_round: round_1,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 50_000_00,
               total_amount_in_cents: 300_00)
      end
      let!(:dividend_2) do
        create(:dividend,
               company: company_2,
               company_investor: investor_2,
               dividend_round: round_2,
               number_of_shares: nil,
               implied_shares: false,
               investment_amount_cents: 75_000_00,
               total_amount_in_cents: 400_00)
      end

      it "updates dividends across different companies" do
        described_class.perform(dry_run: false)

        dividend_1.reload
        expect(dividend_1.number_of_shares).to eq(800)
        expect(dividend_1.implied_shares).to be true

        dividend_2.reload
        expect(dividend_2.number_of_shares).to eq(1_200)
        expect(dividend_2.implied_shares).to be true
      end
    end
  end
end
