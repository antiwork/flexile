# frozen_string_literal: true

class OnboardingState::Worker < OnboardingState::BaseUser
  def complete?
    super && user.company_worker_for(company)&.role.present?
  end

  def redirect_path
    if !has_personal_details?
      return spa_company_worker_onboarding_path(company.external_id)
    end
    "/documents" unless user.company_worker_for(company)&.role.present?
  end

  def after_complete_onboarding_path
    # Rely on the front-end logic to redirect to the role-specific page.
    "/dashboard"
  end
end
