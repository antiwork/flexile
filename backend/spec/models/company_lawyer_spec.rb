# frozen_string_literal: true

RSpec.describe CompanyLawyer do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    before { create(:company_lawyer) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:company_id) }
  end
end
