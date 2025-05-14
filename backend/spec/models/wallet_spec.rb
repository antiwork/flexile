# frozen_string_literal: true

RSpec.describe Wallet do
  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.ancestors.include?(Deletable)).to eq(true)
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:wallet_address) }
    it { is_expected.to allow_value("0x1234f5ea0ba39494ce839613fffba74279579268").for(:wallet_address) }
    it { is_expected.to_not allow_value("0x1234f5ea0ba39494ce839613@@@ba74279579268").for(:wallet_address) }
    it { is_expected.to_not allow_value("001234f5ea0ba39494ce839613fffba74279579268").for(:wallet_address) }
    it { is_expected.to_not allow_value("0x1234f5ea0ba39494ce839613fffba7427957926").for(:wallet_address) }
    it { is_expected.to_not allow_value("invalid").for(:wallet_address) }
  end
end
