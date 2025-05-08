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
  end
end
