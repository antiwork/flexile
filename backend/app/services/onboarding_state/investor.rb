# frozen_string_literal: true

class OnboardingState::Investor < OnboardingState::BaseUser
  def redirect_path
    if !has_personal_details?
      spa_company_investor_onboarding_path(company.external_id)
    end
  end

  def after_complete_onboarding_path
    "/settings/payouts"
  end
end
