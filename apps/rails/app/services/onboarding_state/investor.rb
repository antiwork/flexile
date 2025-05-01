# frozen_string_literal: true

class OnboardingState::Investor < OnboardingState::BaseUser
  def redirect_path
    if !has_personal_details?
      spa_company_investor_onboarding_path(company.external_id)
    elsif !has_legal_details? || !has_tax_info?
      spa_company_investor_onboarding_legal_path(company.external_id)
    end
  end

  def after_complete_onboarding_path
    "/settings/payouts"
  end

  def complete?
    super && has_tax_info?
  end

  private
    def has_tax_info?
      user.tax_id.present? && (user.requires_w9? || user.birth_date.present?)
    end
end
