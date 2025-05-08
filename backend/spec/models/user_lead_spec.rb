# frozen_string_literal: true

RSpec.describe UserLead do
  describe "validations" do
    subject { build(:user_lead) }

    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_uniqueness_of(:email) }
  end
end
