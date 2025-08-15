# frozen_string_literal: true

class InviteWorker
  attr_reader :current_user, :company, :company_administrator, :email,
              :attachment
  attr_accessor :params

  def initialize(current_user:, company:, company_administrator:, worker_params:)
    @current_user = current_user
    @company = company
    @company_administrator = company_administrator
    @params = worker_params.dup
    @email = @params.delete(:email)
  end

  def perform
    user = User.find_or_initialize_by(email:)
    is_existing_user = user.persisted?
    if is_existing_user
      existing_company_worker = user.company_workers.active.find_by(company:)
      if existing_company_worker.present?
        error_message = "Invitee is already working for this company."
        if !user.has_personal_details?
          # Resend the invitation only if the user hasn't completed onboarding (they may have missed the first invitation
          # email)
          GenerateContractorInvitationJob.perform_async(existing_company_worker.id)
          error_message += " A new invitation email has been sent."
        end
        return { success: false, error_message: }
      end
    end

    contract = params.delete(:contract)
    company_worker = user.company_workers.find_or_initialize_by(company:)
    company_worker.assign_attributes(**params, ended_at: nil)

    if is_existing_user
      user.invited_by = current_user
      user.save && company_worker.save
    else
      user.invite!(current_user) { |u| u.skip_invitation = true }
    end

    if user.errors.blank? && company_worker.errors.blank?
      document = nil
      unless company_worker.contract_signed_elsewhere
        document = CreateConsultingContract.new(company_worker:, company_administrator:, contract:).perform!
      end
      GenerateContractorInvitationJob.perform_async(company_worker.id, is_existing_user)

      { success: true, company_worker:, document: }
    else
      error_object = if company_worker.errors.any?
        company_worker
      else
        user
      end
      error_message = error_object.errors.full_messages.to_sentence
      # Transform technical validation messages to user-friendly ones
      error_message = error_message.gsub("Pay rate in subunits must be greater than 0", "Please enter a rate above $0.")
      { success: false, error_message: }
    end
  end
end
