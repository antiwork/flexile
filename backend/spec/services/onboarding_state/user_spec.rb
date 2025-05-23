# frozen_string_literal: true

RSpec.describe OnboardingState::User do
  include Rails.application.routes.url_helpers

  describe "#redirect_path" do
    context "when the user is a contractor" do
      let(:company_worker) { create(:company_worker) }
      let(:user) { company_worker.user }
      let(:company) { company_worker.company }

      it "calls `OnboardingState::Worker#redirect_path`" do
        service = described_class.new(user:, company:)

        expect_any_instance_of(OnboardingState::Worker).to receive(:redirect_path)

        service.redirect_path
      end
    end

    context "when the user is an administrator" do
      let(:company_administrator) { create(:company_administrator) }
      let(:user) { company_administrator.user }
      let(:company) { company_administrator.company }

      it "calls `OnboardingState::Company#redirect_path`" do
        service = described_class.new(user:, company:)

        expect_any_instance_of(OnboardingState::Company).to receive(:redirect_path)

        service.redirect_path
      end
    end

    context "when the user is a lawyer" do
      let(:company_lawyer) { create(:company_lawyer) }
      let(:user) { company_lawyer.user }
      let(:company) { company_lawyer.company }

      it "calls `OnboardingState::Lawyer#redirect_path` for a lawyer" do
        service = described_class.new(user:, company:)

        expect_any_instance_of(OnboardingState::Lawyer).to receive(:redirect_path)

        service.redirect_path
      end
    end

    context "when the user is an investor" do
      let(:company_investor) { create(:company_investor) }
      let(:user) { company_investor.user }
      let(:company) { company_investor.company }

      it "calls `OnboardingState::Investor#redirect_path`" do
        service = described_class.new(user:, company:)

        expect_any_instance_of(OnboardingState::Investor).to receive(:redirect_path)

        service.redirect_path
      end
    end

    it "returns admin onboarding for a user with an unknown role" do
      user = create(:user)

      expect(described_class.new(user:, company: nil).redirect_path).to eq spa_company_administrator_onboarding_details_path("_")
    end
  end
end
