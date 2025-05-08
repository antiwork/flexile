# frozen_string_literal: true

class OnboardingState::Lawyer < OnboardingState::BaseUser
  def complete?
    true
  end

  def redirect_path
    nil
  end

  def after_complete_onboarding_path
    "/documents"
  end
end
