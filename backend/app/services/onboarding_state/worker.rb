# frozen_string_literal: true

class OnboardingState::Worker < OnboardingState::BaseUser
  def complete?
    super
  end

  def redirect_path
    if !has_personal_details?
      spa_company_worker_onboarding_path(company.external_id)
    end
  end

  def needs_work_details?
    return false unless company_worker.present?
    
    # Check if this worker came from contractor invite (has placeholder values)
    company_worker.pay_rate_in_subunits == 1 && company_worker.role == "Contractor"
  end

  private

  def company_worker
    @company_worker ||= user.company_worker_for(company)
  end

  def after_complete_onboarding_path
    # Rely on the front-end logic to redirect to the role-specific page.
    "/dashboard"
  end
end
