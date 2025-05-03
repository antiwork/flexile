# frozen_string_literal: true

RSpec.describe OnboardingState::WorkerWithoutCompany do
  include Rails.application.routes.url_helpers

  let(:user) { create(:user, inviting_company: true) }
  let(:service) { described_class.new(user:, company: nil) }

  describe "#redirect_path" do
    it "returns the path to the personal details page if the user is missing personal details" do
      allow(service).to receive(:has_personal_details?).and_return(false)

      expect(service.redirect_path).to eq(spa_onboarding_path)
    end

    it "returns the path to the legal details page if the user is missing legal details" do
      allow(service).to receive(:has_personal_details?).and_return(true)
      allow(service).to receive(:has_legal_details?).and_return(false)

      expect(service.redirect_path).to eq(spa_onboarding_legal_path)
    end

    it "returns nil if all onboarding data is present" do
      allow(service).to receive(:has_personal_details?).and_return(true)

      expect(service.redirect_path).to be_nil
    end

    it "returns nil if the user is from a sanctioned country and has all other details" do
      allow(service).to receive(:has_personal_details?).and_return(true)
      allow(user).to receive(:sanctioned_country_resident?).and_return(true)

      expect(service.redirect_path).to be_nil
    end
  end

  describe "#after_complete_onboarding_path" do
    it "returns the root path" do
      expect(service.after_complete_onboarding_path).to eq("/company_invitations/new")
    end
  end
end
