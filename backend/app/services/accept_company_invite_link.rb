# frozen_string_literal: true

class AcceptCompanyInviteLink
  def initialize(token:, user:)
    @token = token
    @user = user
  end

  def perform
    invite_link = CompanyInviteLink.find_by(token: @token)
    return { success: false, error: "Invalid invite link" } unless invite_link

    company = invite_link.company
    company_worker = @user.company_workers.find_or_initialize_by(company:)
    if company_worker.persisted?
      return { success: false, error: "You are already a worker for this company" }
    end

    company_worker.assign_attributes(
      pay_rate_type: 0,
      started_at: Time.current,
      contract_signed_elsewhere: invite_link.document_template_id.nil?,
      ended_at: nil
    )

    if company_worker.save
      @user.update!(signup_invite_link: invite_link)

      unless company_worker.contract_signed_elsewhere
        CreateConsultingContract.new(company_worker:, company_administrator: company.primary_admin, current_user: @user).perform!
      end
      { success: true, company_worker: company_worker }
    else
      { success: false, error: company_worker.errors.full_messages.to_sentence }
    end
  end
end
