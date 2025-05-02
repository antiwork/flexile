# frozen_string_literal: true

class OnboardingState::WorkerWithoutCompany < OnboardingState::BaseUser
  def redirect_path
    if !has_personal_details?
      spa_onboarding_path
    elsif !has_bank_details? && !user.sanctioned_country_resident?
      spa_onboarding_bank_account_path
    end
  end

  def after_complete_onboarding_path
    "/company_invitations/new"
  end
end
