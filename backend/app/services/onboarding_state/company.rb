# frozen_string_literal: true

class OnboardingState::Company
  include Rails.application.routes.url_helpers

  delegate :name, :email, :street_address, :city, :state, :zip_code, :bank_account_added?,
           to: :company, allow_nil: true

  def initialize(company)
    @company = company
  end

  def redirect_path
    if !has_company_details?
      spa_company_administrator_onboarding_details_path(company.external_id)
    elsif !bank_account_added?
      spa_company_administrator_onboarding_bank_account_path(company.external_id)
    end
  end

  def redirect_path_from_onboarding_details
    return completed_redirect_path if complete?

    spa_company_administrator_onboarding_bank_account_path(company.external_id) if has_company_details?
  end

  def redirect_path_from_onboarding_payment_details
    return completed_redirect_path if complete?

    spa_company_administrator_onboarding_details_path(company.external_id) if !has_company_details?
  end

  def redirect_path_after_onboarding_details_success
    bank_account_added? ? completed_redirect_path : spa_company_administrator_onboarding_bank_account_path(company.external_id)
  end

  def complete?
    has_company_details? && bank_account_added?
  end

  private
    attr_reader :company

    def has_company_details?
      [name, street_address, city, state, zip_code].all?(&:present?)
    end

    def needs_contract_details?
      company.company_workers.first!.user.unsigned_contracts.exists?
    end

    def completed_redirect_path
      "/people"
    end
end
