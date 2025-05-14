# frozen_string_literal: true

RSpec.describe ConvertibleInvestment do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:convertible_securities) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:company_valuation_in_dollars) }
    it { is_expected.to validate_numericality_of(:company_valuation_in_dollars).only_integer.is_greater_than_or_equal_to(0) }

    it { is_expected.to validate_presence_of(:amount_in_cents) }
    it { is_expected.to validate_numericality_of(:amount_in_cents).only_integer.is_greater_than_or_equal_to(0) }

    it { is_expected.to validate_presence_of(:implied_shares) }
    it { is_expected.to validate_numericality_of(:implied_shares).only_integer.is_greater_than_or_equal_to(1) }

    it { is_expected.to validate_presence_of(:valuation_type) }
    it { is_expected.to validate_inclusion_of(:valuation_type).in_array(%w(Pre-money Post-money)) }

    it { is_expected.to validate_presence_of(:identifier) }
    it { is_expected.to validate_presence_of(:entity_name) }
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:convertible_type) }
  end

  describe "callbacks" do
    describe "#update_implied_shares_for_securities" do
      let(:convertible_investment) { create(:convertible_investment, amount_in_cents: 1_234_567_58) }
      let(:convertible_security1) do create(:convertible_security, principal_value_in_cents: 567_873_34,
                                                                   convertible_investment:) end
      let(:convertible_security2) do create(:convertible_security, principal_value_in_cents: 234_345_12,
                                                                   convertible_investment:) end
      let(:convertible_security3) do create(:convertible_security, principal_value_in_cents: 432_349_12,
                                                                   convertible_investment:) end

      it "updates the implied shares for the convertible securities" do
        expect do
          convertible_investment.update(implied_shares: 765_432)
        end.to change { convertible_security1.reload.implied_shares }.to(765_432.to_d / 1_234_567_58 * 567_873_34)
           .and change { convertible_security2.reload.implied_shares }.to(765_432.to_d / 1_234_567_58 * 234_345_12)
           .and change { convertible_security3.reload.implied_shares }.to(765_432.to_d / 1_234_567_58 * 432_349_12)
      end
    end
  end
end
