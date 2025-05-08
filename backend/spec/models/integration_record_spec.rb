# frozen_string_literal: true

RSpec.describe IntegrationRecord do
  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.ancestors.include?(Deletable)).to eq(true)
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:integration) }
    it { is_expected.to belong_to(:integratable) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:integration) }
    it { is_expected.to validate_presence_of(:integratable_id) }
    it { is_expected.to validate_presence_of(:integratable_type) }
    it { is_expected.to validate_presence_of(:integration_external_id) }
  end
end
