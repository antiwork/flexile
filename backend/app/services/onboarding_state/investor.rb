# frozen_string_literal: true

class OnboardingState::Investor < OnboardingState::BaseUser
  def redirect_path
    if !has_personal_details?
      spa_company_investor_onboarding_path(company.external_id)
    end
  end

  def after_complete_onboarding_path
    has_dividends? ? "/equity/dividends" : "/dashboard"
  end

  private

  def has_dividends?
    company_investor = user.company_investors.find_by(company: company)
    return false unless company_investor

    company_investor.dividends.exists?
  end
end
