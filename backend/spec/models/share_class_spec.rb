# frozen_string_literal: true

RSpec.describe ShareClass do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:share_holdings) }
  end

  describe "validations" do
    before { create(:share_class) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_uniqueness_of(:name).scoped_to(:company_id) }
    it { is_expected.to validate_presence_of(:liquidation_preference_multiple) }
    it { is_expected.to validate_numericality_of(:liquidation_preference_multiple).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_inclusion_of(:participating).in_array([true, false]) }
    it { is_expected.to validate_numericality_of(:participation_cap_multiple).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:seniority_rank).is_greater_than_or_equal_to(0).only_integer }

    describe "participation_cap_multiple" do
      it "allows nil values" do
        share_class = build(:share_class, participation_cap_multiple: nil)
        expect(share_class).to be_valid
      end
    end

    describe "seniority_rank" do
      it "allows nil values" do
        share_class = build(:share_class, seniority_rank: nil)
        expect(share_class).to be_valid
      end
    end
  end
end
