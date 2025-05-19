# frozen_string_literal: true

RSpec.describe CompanyInvestor do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:convertible_securities) }
    it { is_expected.to have_many(:share_holdings) }
    it { is_expected.to have_many(:tender_offer_bids) }
    it { is_expected.to have_many(:equity_buybacks) }
    it { is_expected.to have_many(:equity_grants) }
    it { is_expected.to have_many(:equity_grant_exercises) }
    it { is_expected.to have_many(:dividends) }
    it { is_expected.to have_many(:investor_dividend_rounds) }
  end

  describe "validations" do
    before { create(:company_investor) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:company_id) }
    it { is_expected.to validate_presence_of(:total_shares) }
    it { is_expected.to validate_presence_of(:total_options) }
    it { is_expected.to validate_numericality_of(:total_shares).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_numericality_of(:total_options).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:investment_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:investment_amount_in_cents).is_greater_than_or_equal_to(0).only_integer }
  end

  describe "virtual attributes" do
    let(:company_investor) { create(:company_investor, total_options: 1_922, total_shares: 98_234) }

    it "calculates fully_diluted_shares" do
      expect(company_investor.fully_diluted_shares).to eq(1_922 + 98_234)
    end
  end

  describe "scopes" do
    describe ".with_shares_or_options" do
      before do
        create(:company_investor)
        @company_investor_with_shares = create(:company_investor, total_shares: 1)
        @company_investor_with_options = create(:company_investor, total_options: 100)
      end

      it "returns only company investors with shares" do
        expect(described_class.with_shares_or_options).to match_array([
                                                                        @company_investor_with_options, @company_investor_with_shares])
      end
    end

    describe ".with_required_tax_info_for" do
      let(:company) { create(:company, irs_tax_forms:) }
      let(:tax_year) { Date.current.year }
      let(:company_investor_1) do
        user = create(:user, citizenship_country_code: "IN")
        create(:company_investor, company:, user:)
      end
      let(:company_investor_2) do
        user = create(:user, country_code: "AE")
        create(:company_investor, company:, user:)
      end
      let(:company_investor_3) do
        user = create(:user, country_code: "FR", citizenship_country_code: "FR")
        create(:company_investor, company:, user:)
      end
      let(:company_investor_4) do
        user = create(:user)
        create(:company_investor, company:, user:)
      end

      before do
        create(:dividend, :paid, company_investor: company_investor_1, company:, total_amount_in_cents: 1000_00)
        create(:dividend, :paid, company_investor: company_investor_2, company:, total_amount_in_cents: 300_00)
        create(:dividend, :paid, company_investor: company_investor_2, company:, total_amount_in_cents: 300_00)
        create(:dividend, :paid, company_investor: company_investor_3, company:, total_amount_in_cents: 1000_00)

        # Not paid dividend
        create(:dividend, company_investor: company_investor_4, company:, total_amount_in_cents: 1000_00)

        # Investor with a dividend below the minimum threshold
        company_investor_5 = create(:company_investor, company:, user: create(:user))
        create(:dividend, :paid, company_investor: company_investor_5, company:, total_amount_in_cents: 9_99)

        # Investor with a dividend above threshold but not in the given tax year
        company_investor_6 = create(:company_investor, company:, user: create(:user))
        create(:dividend, :paid, company_investor: company_investor_6, company:,
                                 total_amount_in_cents: 1000_00, created_at: Date.current.prev_year,
                                 paid_at: Date.current.prev_year)
      end

      context "when 'irs_tax_forms' bit flag is not set for the company" do
        let(:irs_tax_forms) { false }

        it "returns an empty array" do
          expect(described_class.with_required_tax_info_for(tax_year:)).to eq([])
        end
      end

      context "when 'irs_tax_forms' bit flag is set for the company" do
        let(:irs_tax_forms) { true }

        it "returns the list of company_workers who are eligible for 1099-NEC" do
          expect(described_class.with_required_tax_info_for(tax_year:)).to match_array(
            [company_investor_1, company_investor_2, company_investor_3]
          )
        end
      end
    end
  end

  describe "#completed_onboarding?" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }
    let(:company_investor) { create(:company_investor, user:, company:) }

    context "when the user has completed onboarding" do
      before do
        allow_any_instance_of(OnboardingState::Investor).to receive(:complete?).and_return(true)
      end

      it "returns true" do
        expect(company_investor.completed_onboarding?).to eq(true)
      end
    end

    context "when the user has not completed onboarding" do
      before do
        allow_any_instance_of(OnboardingState::Investor).to receive(:complete?).and_return(false)
      end

      it "returns false" do
        expect(company_investor.completed_onboarding?).to eq(false)
      end
    end
  end
end
