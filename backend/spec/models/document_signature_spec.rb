# frozen_string_literal: true

RSpec.describe DocumentSignature do
  describe "associations" do
    it { is_expected.to belong_to(:document) }
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:title) }
  end
end
