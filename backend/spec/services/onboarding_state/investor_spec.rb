# frozen_string_literal: true

RSpec.describe OnboardingState::Investor do
  include Rails.application.routes.url_helpers

  let(:user) { create(:user) }
  let(:company_investor) { create(:company_investor, user:) }
  let(:company) { company_investor.company }
  let(:service) { described_class.new(user:, company:) }

  describe "#has_personal_details?" do
    it "returns true when all required data is present" do
      expect(service.has_personal_details?).to eq(true)
    end

    it "returns false if legal_name is missing" do
      user.update!(legal_name: nil)

      expect(service.has_personal_details?).to eq(false)
    end

    it "returns false if preferred_name is missing" do
      user.update!(preferred_name: nil)

      expect(service.has_personal_details?).to eq(false)
    end

    it "returns false if citizenship_country_code is missing" do
      user.update!(citizenship_country_code: nil)

      expect(service.has_personal_details?).to eq(false)
    end
  end

  describe "#complete?" do
    it "returns true when all required onboarding data is set" do
      expect(service.complete?).to eq(true)
    end

    it "returns false if legal_name is missing" do
      user.update!(legal_name: nil)

      expect(service.complete?).to eq(false)
    end

    it "returns false if preferred_name is missing" do
      user.update!(preferred_name: nil)

      expect(service.complete?).to eq(false)
    end

    it "returns false if citizenship_country_code is missing" do
      user.update!(citizenship_country_code: nil)

      expect(service.complete?).to eq(false)
    end
  end

  describe "#redirect_path" do
    it "returns the path to the personal details page if the user is missing personal details" do
      allow(service).to receive(:has_personal_details?).and_return(false)

      expect(service.redirect_path).to eq(spa_company_investor_onboarding_path(company.external_id))
    end

    it "returns nil if all onboarding data is present" do
      expect(service.redirect_path).to eq(nil)
    end
  end

  describe "#after_complete_onboarding_path" do
    context "when investor has dividends" do
      it "redirects to the dividends page" do
        create(:dividend, company_investor:)

        expect(service.after_complete_onboarding_path).to eq("/equity/dividends")
      end
    end

    context "when investor does not have dividends" do
      it "redirects to the dashboard" do
        expect(service.after_complete_onboarding_path).to eq("/dashboard")
      end
    end

    context "when user has no company investor record" do
      let(:user_without_investment) { create(:user) }
      let(:service_without_investment) { described_class.new(user: user_without_investment, company:) }

      it "redirects to the dashboard" do
        expect(service_without_investment.after_complete_onboarding_path).to eq("/dashboard")
      end
    end
  end
end
