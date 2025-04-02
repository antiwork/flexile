# frozen_string_literal: true

class InviteWorker
  attr_reader :current_user, :company, :company_administrator, :email,
              :attachment, :application, :docuseal_submission_id
  attr_accessor :params

  def initialize(current_user:, company:, company_administrator:, worker_params:, application: nil)
    @current_user = current_user
    @company = company
    @company_administrator = company_administrator
    @params = worker_params.dup
    @email = @params.delete(:email)
    @application = application
  end

  def perform
    user = User.find_or_initialize_by(email:)
    is_existing_user = user.persisted?
    if is_existing_user
      existing_company_worker = user.company_workers.active.find_by(company:)
      if existing_company_worker.present?
        error_message = "Invitee is already working for this company."
        if !OnboardingState::Worker.new(user:, company:).complete?
          # Resend the invitation only if the user hasn't completed onboarding (they may have missed the first invitation
          # email)
          GenerateContractorInvitationJob.perform_async(existing_company_worker.id)
          error_message += " A new invitation email has been sent."
        end
        return { success: false, error_message: }
      end
    end

    role = company.company_roles.find_by(external_id: params.delete(:role_id))
    return { success: false, error_message: "Role not found" } unless role.present?
    company_worker = user.company_workers.find_or_initialize_by(company:)
    user.inviting_company = false
    company_worker.company_role = role if role
    company_worker.assign_attributes(**params, ended_at: nil)

    if is_existing_user
      user.invited_by = current_user
      user.save && company_worker.save
    else
      user.invite!(current_user) { |u| u.skip_invitation = true }
    end

    if user.errors.blank? && company_worker.errors.blank?
      document = CreateConsultingContract.new(company_worker:, company_administrator:, current_user:).perform!
      ContractorProfile.find_or_create_by(user:, available_hours_per_week: 1)
      GenerateContractorInvitationJob.perform_async(company_worker.id, is_existing_user)
      @application&.accepted!

      { success: true, company_worker:, document: }
    else
      error_object = if company_worker.errors.any?
        company_worker
      else
        user
      end
      { success: false, error_message: error_object.errors.full_messages.to_sentence }
    end
  end
end
