# frozen_string_literal: true

class OnboardingState::WorkerWithoutCompany < OnboardingState::BaseUser
  def redirect_path
    if !has_personal_details?
      spa_onboarding_path
    end
  end

  def after_complete_onboarding_path
    "/company_invitations/new"
  end
end
