# frozen_string_literal: true

RSpec.describe OptionPool do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:share_class) }
    it { is_expected.to have_many(:equity_grants) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:default_option_expiry_months) }
    it { is_expected.to validate_numericality_of(:default_option_expiry_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:authorized_shares) }
    it { is_expected.to validate_numericality_of(:authorized_shares).only_integer.is_greater_than_or_equal_to(1) }
    it { is_expected.to validate_presence_of(:issued_shares) }
    it { is_expected.to validate_numericality_of(:issued_shares).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:voluntary_termination_exercise_months) }
    it { is_expected.to validate_numericality_of(:voluntary_termination_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:involuntary_termination_exercise_months) }
    it { is_expected.to validate_numericality_of(:involuntary_termination_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:termination_with_cause_exercise_months) }
    it { is_expected.to validate_numericality_of(:termination_with_cause_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:death_exercise_months) }
    it { is_expected.to validate_numericality_of(:death_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:disability_exercise_months) }
    it { is_expected.to validate_numericality_of(:disability_exercise_months).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:retirement_exercise_months) }
    it { is_expected.to validate_numericality_of(:retirement_exercise_months).only_integer.is_greater_than_or_equal_to(0) }

    describe "#issued_shares_cannot_exceed_authorized_shares" do
      let(:option_pool) { build(:option_pool) }

      it "is invalid when issued_shares is greater than authorized_shares" do
        expect(option_pool).to be_valid

        option_pool.issued_shares = option_pool.authorized_shares + 1
        expect(option_pool).to be_invalid
      end
    end
  end

  describe "virtual attributes" do
    let(:option_pool) { create(:option_pool) }

    it "calculates available_shares" do
      expect(option_pool.available_shares).to eq(option_pool.authorized_shares - option_pool.issued_shares)
    end
  end
end
