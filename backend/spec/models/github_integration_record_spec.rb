# frozen_string_literal: true

RSpec.describe GithubIntegrationRecord do
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
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_presence_of(:resource_name) }
    it { is_expected.to validate_presence_of(:resource_id) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_presence_of(:url) }
  end

  describe "#as_json" do
    let(:github_integration_record) { create(:github_integration_record) }

    it "returns the correct attributes" do
      expect(github_integration_record.as_json).to eq({
        id: github_integration_record.id,
        external_id: github_integration_record.integration_external_id,
        description: github_integration_record.description,
        resource_id: github_integration_record.resource_id,
        resource_name: github_integration_record.resource_name,
        status: github_integration_record.status,
        url: github_integration_record.url,
      })
    end
  end
end
