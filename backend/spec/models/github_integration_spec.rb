# frozen_string_literal: true

RSpec.describe GithubIntegration do
  describe "validations" do
    it { is_expected.to validate_presence_of(:organizations) }
  end

  describe "#update_tokens!" do
    let(:integration) { build(:github_integration) }
    let(:time) { Time.utc(2023, 1, 1) }
    let(:response) { double("Response") }

    before do
      allow(response).to receive(:parsed_response).and_return({ "access_token" => "token" })
    end

    it "sets the new token" do
      integration.update_tokens!(response)
      expect(integration.access_token).to eq("token")
    end
  end

  describe "#mark_deleted!" do
    let(:integration) { create(:github_integration) }
    let!(:integration_record) { create(:integration_record, integration:) }

    it "marks the integration and corresponding records as deleted" do
      integration.mark_deleted!
      expect(integration.reload.status).to eq("deleted")
      expect(integration.reload.deleted_at).to be_present
      expect(integration_record.reload.deleted_at).to be_present
    end
  end
end
