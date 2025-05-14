# frozen_string_literal: true

RSpec.describe TosAgreement do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:user_id) }
    it { is_expected.to validate_presence_of(:ip_address) }
  end
end
