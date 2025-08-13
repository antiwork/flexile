# frozen_string_literal: true

class AcceptCompanyInviteLink
  def initialize(token:, user:)
    @token = token
    @user = user
  end

  def perform
    company = Company.find_by(invite_link: @token)
    return { success: false, error: "Invalid invite link" } unless company

    company_worker = @user.company_workers.find_or_initialize_by(company:)
    if company_worker.persisted?
      return { success: false, error: "You are already a worker for this company" }
    end

    company_worker.assign_attributes(
      pay_rate_type: 0,
      started_at: Time.current,
      contract_signed_elsewhere: true,
      ended_at: nil
    )

    if company_worker.save
      { success: true, company: }
    else
      { success: false, error: company_worker.errors.full_messages.to_sentence }
    end
  end
end
