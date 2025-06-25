# frozen_string_literal: true

class OnboardingState::Company
  include Rails.application.routes.url_helpers

  delegate :name, :email, :street_address, :city, :state, :zip_code,
           to: :company, allow_nil: true

  def initialize(company)
    @company = company
  end

  def redirect_path
    nil
  end

  def redirect_path_from_onboarding_details
    completed_redirect_path if complete?
  end

  def redirect_path_after_onboarding_details_success
    completed_redirect_path
  end

  def complete?
    true
  end

  private
    attr_reader :company

    def has_company_details?
      true
    end

    def needs_contract_details?
      company.company_workers.first!.user.unsigned_contracts.exists?
    end

    def completed_redirect_path
      "/people"
    end
end
