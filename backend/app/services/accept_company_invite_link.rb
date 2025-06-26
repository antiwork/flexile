# frozen_string_literal: true

class AcceptCompanyInviteLink
  def initialize(token:, user:)
    @token = token
    @user = user
  end

  def perform
    invite_link = CompanyInviteLink.find_by(token: token)
    return { success: false, error: "Invalid invite link" } unless invite_link

    company = invite_link.company

    if user.company_worker_for?(company)
      return { success: false, error: "You are already a worker for this company" }
    end

    company_worker = company.company_workers.create(user: user)
    if company_worker.persisted?
      inviter = invite_link.inviter
      CompanyWorkerMailer.notify_invite_accepted(inviter, user).deliver_later if inviter

      { success: true, company_worker: company_worker }
    else
      { success: false, error: company_worker.errors.full_messages.to_sentence }
    end
  end
end
