# frozen_string_literal: true

class CompleteInviteLinkOnboarding
  def initialize(user:, company:, update_params:)
    @user = user
    @company = company
    @update_params = update_params.except(:user_id, :company_id)
  end

  def process
    company_worker = CompanyWorker.find_by(user_id: @user.id, company_id: @company.id)
    return failure(error: "Company worker not found") unless company_worker

    unless company_worker.update(**@update_params)
      return failure(error: company_worker.errors.full_messages.presence || ["Error saving information"])
    end

    send_invite_accepted_email(company_worker)

    if company_worker.contract_signed_elsewhere || @user.signup_invite_link_id.blank?
      return success(company_worker: company_worker)
    end

    invite_link = CompanyInviteLink.find_by(id: @user.signup_invite_link_id)
    return failure(error: "Invite link not found") unless invite_link

    document_result = create_contract_document(company_worker, invite_link)
    return failure(error: document_result[:error]) unless document_result[:success]

    success(company_worker: company_worker, document: document_result[:document], template_id: document_result[:template_id])
  end

  private
    def send_invite_accepted_email(company_worker)
      CompanyWorkerMailer.notify_invite_accepted(company_worker.id).deliver_later
    rescue StandardError => e
      Rails.logger.error("Failed to send invite accepted email: #{e.message}")
    end

    def create_contract_document(company_worker, invite_link)
      template_id = invite_link.document_template_id

      document = CreateConsultingContract.new(
        company_worker: company_worker,
        company_administrator: @company.primary_admin,
        current_user: @user
      ).perform!

      { success: true, document: document, template_id: template_id }
    rescue StandardError => e
      { success: false, error: "Contract creation failed: #{e.message}" }
    end

    def success(company_worker:, document: nil, template_id: nil)
      {
        success: true,
        company_worker: company_worker,
        document: document,
        template_id: template_id,
      }
    end

    def failure(error:)
      {
        success: false,
        error: Array(error).join(". "),
      }
    end
end
