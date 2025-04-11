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

  describe "#has_legal_details?" do
    it "returns true when all required data is present" do
      expect(service.has_legal_details?).to eq(true)
    end

    it "returns false if street_address is missing" do
      user.update!(street_address: nil)

      expect(service.has_legal_details?).to eq(false)
    end

    it "returns false if city is missing" do
      user.update!(city: nil)

      expect(service.has_legal_details?).to eq(false)
    end

    it "returns false if zip_code is missing" do
      user.update!(zip_code: nil)

      expect(service.has_legal_details?).to eq(false)
    end

    it "returns false if the user is a business entity and business_name is missing" do
      user.compliance_info.update!(business_entity: true, business_name: nil)

      expect(service.has_legal_details?).to eq(false)
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

    it "returns false if street_address is missing" do
      user.update!(street_address: nil)

      expect(service.complete?).to eq(false)
    end

    it "returns false if city is missing" do
      user.update!(city: nil)

      expect(service.complete?).to eq(false)
    end

    it "returns false if zip_code is missing" do
      user.update!(zip_code: nil)

      expect(service.complete?).to eq(false)
    end

    it "returns false if the bank account is missing" do
      user.bank_accounts.destroy_all

      expect(service.complete?).to eq(false)
    end

    it "returns true if the bank account is missing but the user is from a sanctioned country" do
      user.bank_accounts.destroy_all
      user.update!(country_code: "CU")

      expect(service.complete?).to eq(true)
    end

    it "returns true if the bank account is missing but the user is from a restricted payout country and has a wallet address" do
      user.bank_accounts.destroy_all
      user.create_wallet(wallet_address: "0x1234f5ea0ba39494ce839613fffba74279579268")
      user.update!(country_code: "NG")

      expect(service.complete?).to eq(true)
    end

    it "returns false if tax ID number is missing" do
      user.compliance_info.update!(tax_id: nil)

      expect(service.complete?).to eq(false)
    end

    it "returns false if the investor is foreign and birth date is missing" do
      user.update!(citizenship_country_code: "CA", country_code: "JP", birth_date: nil)

      expect(service.complete?).to eq(false)
    end

    context "when the user is a business entity" do
      before { user.compliance_info.update!(business_entity: true) }

      it "returns false if there is no business name" do
        expect(service.complete?).to eq(false)
      end

      it "returns true if there is a business name" do
        user.compliance_info.update!(business_name: "Business Inc.")

        expect(service.complete?).to eq(true)
      end
    end
  end

  describe "#redirect_path" do
    it "returns the path to the personal details page if the user is missing personal details" do
      allow(service).to receive(:has_personal_details?).and_return(false)

      expect(service.redirect_path).to eq(spa_company_investor_onboarding_path(company.external_id))
    end

    it "returns the path to the legal details page if the user is missing legal details" do
      allow(service).to receive(:has_legal_details?).and_return(false)

      expect(service.redirect_path).to eq(spa_company_investor_onboarding_legal_path(company.external_id))
    end

    it "returns the path to the legal details page if the user is missing tax info" do
      allow(service).to receive(:has_tax_info?).and_return(false)

      expect(service.redirect_path).to eq(spa_company_investor_onboarding_legal_path(company.external_id))
    end

    it "returns the path to the bank account page if the user is missing bank details" do
      user.bank_accounts.destroy_all

      expect(service.redirect_path).to eq(spa_company_investor_onboarding_bank_account_path(company.external_id))
    end

    it "returns the path to the bank account page if the user is from a restricted payout country and is missing a wallet address" do
      user.bank_accounts.destroy_all
      user.update!(country_code: "NG")

      expect(service.redirect_path).to eq(spa_company_investor_onboarding_bank_account_path(company.external_id))
    end

    it "returns nil if the user is missing bank details and is from a sanctioned country" do
      user.bank_accounts.destroy_all
      user.update!(country_code: "CU")

      expect(service.redirect_path).to be_nil
    end

    it "returns nil if the user is from a restricted payout country and has a wallet address" do
      user.bank_accounts.destroy_all
      user.create_wallet(wallet_address: "0x1234f5ea0ba39494ce839613fffba74279579268")
      user.update!(country_code: "NG")

      expect(service.redirect_path).to be_nil
    end

    it "returns nil if all onboarding data is present" do
      expect(service.redirect_path).to eq(nil)
    end
  end
end
