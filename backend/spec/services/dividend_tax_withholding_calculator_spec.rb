# frozen_string_literal: true

RSpec.describe DividendTaxWithholdingCalculator do
  let(:tax_id) { nil }
  let(:tax_id_status) { nil }
  let(:country_code) { nil }
  let(:user) do
    create(:user, country_code:).tap do |user|
      create(:user_compliance_info, tax_id_status:, user:, country_code:, tax_id:,
                                    tax_information_confirmed_at: tax_id.present? ? Time.current : nil)
    end
  end
  let(:company_investor) { create(:company_investor, user:) }

  describe "#withholding_percentage" do
    let(:dividend) { create(:dividend, company_investor:, total_amount_in_cents: 123_45) }

    context "when user is from US" do
      let(:country_code) { "US" }

      context "and has a valid tax_id" do
        let(:tax_id) { "123456789" }
        let(:tax_id_status) { UserComplianceInfo::TAX_ID_STATUS_VERIFIED }

        it "returns 0" do
          expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(0)
        end
      end

      context "and has an invalid tax_id" do
        let(:tax_id) { "123456789" }

        it "returns 24" do
          expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(24)
        end
      end

      context "and does not have a tax_id" do
        let(:tax_id) { nil }

        it "returns 24" do
          expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(24)
        end
      end

      context "and already has paid dividends for the tax year" do
        before do
          create(:dividend, :paid, company_investor:, total_amount_in_cents: 100_00, withholding_percentage: 24)
          create(:dividend, :paid, company_investor:, total_amount_in_cents: 200_00, withholding_percentage: 30)
        end

        it "returns the highest withholding percentage from the paid dividends" do
          expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(30)
        end
      end
    end

    context "when user is from a country with a specified withholding percentage" do
      let(:country_code) { "JP" } # For example

      it "returns the specified withholding percentage" do
        expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(10)
      end
    end

    context "when user is from a country without a specified withholding percentage" do
      let(:country_code) { "UnknownCountry" } # A country not in the list

      it "returns the default withholding percentage of 30" do
        expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(30)
      end
    end

    context "when the dividend is a return of capital" do
      let(:country_code) { "JP" } # For example
      let(:dividend) { create(:dividend, company_investor:, total_amount_in_cents: 123_45, dividend_round: create(:dividend_round, return_of_capital: true)) }

      it "returns 0 irrespective of the country's withholding percentage" do
        expect(described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend)).to eq(0)
      end
    end

    context "when the dividend passed was not present in the dividends list" do
      let(:dividend2) { create(:dividend, company_investor:, total_amount_in_cents: 123_45) }

      it "raises an error" do
        expect do
          described_class.new(company_investor, dividends: [dividend]).withholding_percentage(dividend2)
        end.to raise_error("The service wasn't initialised with this dividend record")
      end
    end
  end

  describe "#cents_to_withhold" do
    let(:tax_id) { "123456789" } # US user with valid tax_id
    let(:tax_id_status) { UserComplianceInfo::TAX_ID_STATUS_VERIFIED }

    shared_examples_for "returns the correct withholding amount" do |country, expected_amount|
      let(:country_code) { country }

      it "returns the amount in cents (rounded to the dollar) to withhold for the given amount" do
        expect(described_class.new(company_investor, dividends: [dividend1, dividend2]).cents_to_withhold).to eq(expected_amount)
      end
    end

    context "when both dividends have the same withholding rate" do
      let(:dividend1) { create(:dividend, company_investor:, total_amount_in_cents: 61_72) }
      let(:dividend2) { create(:dividend, company_investor:, total_amount_in_cents: 61_73) }

      it_behaves_like "returns the correct withholding amount", "US", 0
      it_behaves_like "returns the correct withholding amount", "PH", 31_00 # 25% withholding
      it_behaves_like "returns the correct withholding amount", "BY", 37_00 # 30% withholding
      it_behaves_like "returns the correct withholding amount", "BE", 19_00 # 15% withholding
    end

    context "when both dividends have the same withholding rate" do
      let(:dividend1) { create(:dividend, company_investor:, total_amount_in_cents: 123_45) }

      # This will have no withholding tax as it is a return of capital
      let(:dividend2) do
        create(:dividend, company_investor:, total_amount_in_cents: 999_99, dividend_round: create(:dividend_round, return_of_capital: true))
      end

      it_behaves_like "returns the correct withholding amount", "US", 0
      it_behaves_like "returns the correct withholding amount", "PH", 31_00 # 25% withholding only one first dividend
      it_behaves_like "returns the correct withholding amount", "BY", 37_00 # 30% withholding only one first dividend
      it_behaves_like "returns the correct withholding amount", "BE", 19_00 # 15% withholding only one first dividend
    end
  end

  describe "#net_cents" do
    let(:tax_id) { "123456789" } # US user with valid tax_id
    let(:tax_id_status) { UserComplianceInfo::TAX_ID_STATUS_VERIFIED }

    shared_examples_for "returns the correct net amount" do |country, expected_amount|
      let(:country_code) { country }

      it "returns the amount in cents (rounded to the dollar) to withhold for the given amount" do
        expect(described_class.new(company_investor, dividends: [dividend1, dividend2]).net_cents).to eq(expected_amount)
      end
    end

    context "when both dividends have the same withholding rate" do
      let(:dividend1) { create(:dividend, company_investor:, total_amount_in_cents: 61_72) }
      let(:dividend2) { create(:dividend, company_investor:, total_amount_in_cents: 61_73) }

      it_behaves_like "returns the correct net amount", "US", 123_45
      it_behaves_like "returns the correct net amount", "PH", 92_45 # 25% withholding: 123.45 - 31.00 = 92.45
      it_behaves_like "returns the correct net amount", "BY", 86_45 # 30% withholding: 123.45 - 37.00 = 86.45
      it_behaves_like "returns the correct net amount", "BE", 104_45 # 15% withholding: 123.45 - 19.00 = 104.45
    end

    context "when both dividends have different withholding rates" do
      let(:dividend1) { create(:dividend, company_investor:, total_amount_in_cents: 123_45) }

      # This will have no withholding tax as it is a return of capital
      let(:dividend2) do
        create(:dividend, company_investor:, total_amount_in_cents: 123_45, dividend_round: create(:dividend_round, return_of_capital: true))
      end

      it_behaves_like "returns the correct net amount", "US", 246_90
      it_behaves_like "returns the correct net amount", "PH", 215_90 # 25% withholding only on first dividend: 246.90 - 31.00 = 215.90
      it_behaves_like "returns the correct net amount", "BY", 209_90 # 30% withholding only on first dividend: 246.90 - 37.00 = 209.90
      it_behaves_like "returns the correct net amount", "BE", 227_90 # 15% withholding only on first dividend: 246.90 - 19.00 = 227.90
    end
  end
end
