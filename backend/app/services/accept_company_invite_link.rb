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
      role: CompanyWorker::PLACEHOLDER_ROLE,
      pay_rate_type: 0,
      pay_rate_in_subunits: 1,
      hours_per_week: 1,
      started_at: Time.current,
      contract_signed_elsewhere: invite_link.document_template_id.nil?,
      ended_at: nil
    )
    @user.invited_by = invite_link.inviter
    @user.save && company_worker.save

    if @user.errors.blank? && company_worker.errors.blank?
      { success: true, company_worker: company_worker }
    else
      error_object = if company_worker.errors.any?
        company_worker
      else
        @user
      end
      { success: false, error: error_object.errors.full_messages.to_sentence }
    end
  end
end
