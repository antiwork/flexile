# frozen_string_literal: true

RSpec.describe OnboardingState::Company do
  include Rails.application.routes.url_helpers

  let(:user) { create(:user, invitation_token: SecureRandom.hex) }
  let(:company) { create(:company, bank_account: build(:company_stripe_account, :initial)) }
  let!(:admin) { create(:company_administrator, user:, company:) }

  describe "#complete?" do
    subject(:service) { described_class.new(company) }

    it "returns true if all onboarding data is present and false otherwise" do
      allow_any_instance_of(Company).to receive(:bank_account_added?).and_return(true)
      expect(service.complete?).to eq true

      allow_any_instance_of(Company).to receive(:name).and_return(nil)
      expect(service.complete?).to eq false
    end
  end

  describe "#redirect_path" do
    it "returns the path to the company details page if the company is missing required details" do
      company.city = nil
      company.save(validate: false)

      expect(described_class.new(company).redirect_path).to eq(spa_company_administrator_onboarding_details_path(company.external_id))
    end

    it "returns nil if all onboarding data is present" do
      company.bank_account.update!(status: CompanyStripeAccount::PROCESSING)
      expect(described_class.new(company.reload).redirect_path).to be_nil
    end

    it "returns the path to the bank account page if the company is missing bank account details" do
      expect(described_class.new(company).redirect_path).to eq(spa_company_administrator_onboarding_bank_account_path(company.external_id))
    end
  end

  describe "#redirect_path_from_onboarding_details" do
    it "returns nil if company details are not set" do
      company.city = nil
      company.save(validate: false)

      expect(described_class.new(company).redirect_path_from_onboarding_details).to be_nil
    end

    it "returns the company bank account onboarding path if company details are set but bank account is not" do
      expect(described_class.new(company).redirect_path_from_onboarding_details).to eq spa_company_administrator_onboarding_bank_account_path(company.external_id)
    end

    it "returns the people path if onboarding is complete" do
      company.bank_account.update!(status: CompanyStripeAccount::PROCESSING)
      expect(described_class.new(company).redirect_path_from_onboarding_details).to eq Rails.application.routes.url_helpers.people_path
    end
  end

  describe "#redirect_path_after_onboarding_details_success" do
    context "when payment details are provided" do
      it "returns the people path" do
        company.bank_account.update!(status: CompanyStripeAccount::PROCESSING)
        expect(described_class.new(company).redirect_path_after_onboarding_details_success).to eq Rails.application.routes.url_helpers.people_path
      end
    end

    context "when payment details are not provided" do
      it "returns the payment details path" do
        expect(described_class.new(company).redirect_path_after_onboarding_details_success).to eq spa_company_administrator_onboarding_bank_account_path(company.external_id)
      end
    end
  end

  describe "#redirect_path_from_onboarding_payment_details" do
    it "returns the company details onboarding path if company details are not set" do
      company.city = nil
      company.save(validate: false)

      expect(described_class.new(company).redirect_path_from_onboarding_payment_details).to eq spa_company_administrator_onboarding_details_path(company.external_id)
    end

    it "returns nil if company details are set but bank account is not" do
      expect(described_class.new(company).redirect_path_from_onboarding_payment_details).to be_nil
    end

    it "returns the people path if onboarding is complete" do
      company.bank_account.update!(status: CompanyStripeAccount::PROCESSING)
      expect(described_class.new(company).redirect_path_from_onboarding_payment_details).to eq Rails.application.routes.url_helpers.people_path
    end
  end
end
