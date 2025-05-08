# frozen_string_literal: true

class GenerateContractorInvitationJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_worker_id, is_existing_user = false)
    company_worker = CompanyWorker.find(company_worker_id)
    company = company_worker.company
    user = company_worker.user

    if is_existing_user
      CompanyWorkerMailer.invite_worker(company_worker.id).deliver_later
    else
      user.deliver_invitation(subject: "You're invited to #{company.name}'s team", reply_to: company.email)
    end
  end
end
