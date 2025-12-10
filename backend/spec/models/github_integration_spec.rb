# frozen_string_literal: true

RSpec.describe GithubIntegration do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:organization_name) }
    it { is_expected.to validate_presence_of(:organization_id) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(GithubIntegration::STATUSES) }

    describe "uniqueness of company_id" do
      let!(:company) { create(:company) }
      let!(:existing_integration) { create(:github_integration, company: company) }

      it "does not allow multiple active integrations for the same company" do
        new_integration = build(:github_integration, company: company)
        expect(new_integration).not_to be_valid
        expect(new_integration.errors[:company_id]).to be_present
      end

      it "allows a new integration if the existing one is deleted" do
        existing_integration.disconnect!
        new_integration = build(:github_integration, company: company)
        expect(new_integration).to be_valid
      end
    end
  end

  describe "scopes" do
    describe ".active" do
      let(:company1) { create(:company) }
      let(:company2) { create(:company) }
      let!(:active_integration) { create(:github_integration, company: company1) }
      let!(:disconnected_integration) { create(:github_integration, :disconnected, company: company2) }

      it "returns only active integrations" do
        expect(described_class.active).to include(active_integration)
        expect(described_class.active).not_to include(disconnected_integration)
      end
    end

    describe ".alive" do
      let(:company1) { create(:company) }
      let(:company2) { create(:company) }
      let!(:alive_integration) { create(:github_integration, company: company1) }
      let!(:deleted_integration) { create(:github_integration, company: company2, deleted_at: Time.current) }

      it "returns only non-deleted integrations" do
        expect(described_class.alive).to include(alive_integration)
        expect(described_class.alive).not_to include(deleted_integration)
      end
    end
  end

  describe "#active?" do
    it "returns true when status is active and not deleted" do
      integration = build(:github_integration, status: GithubIntegration::ACTIVE, deleted_at: nil)
      expect(integration.active?).to be true
    end

    it "returns false when status is disconnected" do
      integration = build(:github_integration, status: GithubIntegration::DISCONNECTED)
      expect(integration.active?).to be false
    end

    it "returns false when deleted_at is set" do
      integration = build(:github_integration, status: GithubIntegration::ACTIVE, deleted_at: Time.current)
      expect(integration.active?).to be false
    end
  end

  describe "#access_token_valid?" do
    it "returns true when access_token is present and not expired" do
      integration = build(:github_integration, access_token: "token123", access_token_expires_at: 1.hour.from_now)
      expect(integration.access_token_valid?).to be true
    end

    it "returns true when access_token is present and no expiration is set" do
      integration = build(:github_integration, access_token: "token123", access_token_expires_at: nil)
      expect(integration.access_token_valid?).to be true
    end

    it "returns false when access_token is blank" do
      integration = build(:github_integration, access_token: nil)
      expect(integration.access_token_valid?).to be false
    end

    it "returns false when access_token is expired" do
      integration = build(:github_integration, access_token: "token123", access_token_expires_at: 1.hour.ago)
      expect(integration.access_token_valid?).to be false
    end
  end

  describe "#needs_token_refresh?" do
    it "returns true when token expires within 5 minutes" do
      integration = build(:github_integration, access_token_expires_at: 3.minutes.from_now)
      expect(integration.needs_token_refresh?).to be true
    end

    it "returns false when token expires in more than 5 minutes" do
      integration = build(:github_integration, access_token_expires_at: 10.minutes.from_now)
      expect(integration.needs_token_refresh?).to be false
    end

    it "returns false when access_token_expires_at is nil" do
      integration = build(:github_integration, access_token_expires_at: nil)
      expect(integration.needs_token_refresh?).to be false
    end
  end

  describe "#update_tokens!" do
    let(:integration) { create(:github_integration) }

    it "updates the access token" do
      integration.update_tokens!(access_token: "new_token")
      expect(integration.reload.access_token).to eq("new_token")
    end

    it "updates expires_at when provided" do
      expires_at = 1.hour.from_now
      integration.update_tokens!(access_token: "new_token", expires_at: expires_at)
      expect(integration.reload.access_token_expires_at).to be_within(1.second).of(expires_at)
    end

    it "updates refresh_token when provided" do
      integration.update_tokens!(access_token: "new_token", refresh_token: "new_refresh")
      expect(integration.reload.refresh_token).to eq("new_refresh")
    end
  end

  describe "#disconnect!" do
    let!(:integration) { create(:github_integration) }

    it "marks the integration as disconnected", :freeze_time do
      integration.disconnect!

      expect(integration.status).to eq(GithubIntegration::DISCONNECTED)
      expect(integration.deleted_at).to eq(Time.current)
    end
  end

  describe "paper_trail" do
    it "tracks changes" do
      integration = create(:github_integration)
      expect(integration.versions.count).to eq(1)

      integration.update!(organization_name: "NewOrg")
      expect(integration.versions.count).to eq(2)
    end
  end

  describe "token storage" do
    let(:integration) { create(:github_integration, access_token: "secret_token", refresh_token: "secret_refresh") }

    it "stores and retrieves access_token" do
      expect(integration.reload.access_token).to eq("secret_token")
    end

    it "stores and retrieves refresh_token" do
      expect(integration.reload.refresh_token).to eq("secret_refresh")
    end
  end
end
