# frozen_string_literal: true

RSpec.describe OnboardingState::Lawyer do
  include Rails.application.routes.url_helpers

  let(:user) { create(:user, invitation_token: SecureRandom.hex) }
  let(:company) { create(:company) }
  let!(:lawyer) { create(:company_lawyer, user:, company:) }

  describe "#complete?" do
    subject(:service) { described_class.new(user:, company:) }

    it "returns true" do
      expect(service.complete?).to eq(true)
    end
  end

  describe "#redirect_path" do
    subject(:service) { described_class.new(user:, company:) }

    it "returns nil" do
      expect(service.redirect_path).to be_nil
    end
  end

  describe "#after_complete_onboarding_path" do
    subject(:service) { described_class.new(user:, company:) }

    it "returns the cap table path" do
      expect(service.after_complete_onboarding_path).to eq("/documents")
    end
  end
end
