# frozen_string_literal: true

class CompleteInviteLinkOnboarding
  def initialize(user:, company:, update_params:)
    @user = user
    @company = company
    @update_params = update_params.except(:user_id, :company_id)
  end

  def process
    company_worker = CompanyWorker.find_by(user_id: @user.id, company_id: @company.id)
    return "Company worker not found" unless company_worker

    puts "Updating company worker with params: ######==> #{update_params.inspect}"
    error = nil
    company_worker.assign_attributes(**update_params)
    company_worker.save

    if company_worker.errors.blank?
      CompanyWorkerMailer.notify_invite_accepted(@user.invited_by_id, company_worker.id).deliver_later
    else
      error = company_worker.errors.full_messages.any? ? company_worker.errors.full_messages.join(". ") : "Error saving information"
    end
    puts "Error after updating company worker: ###>> #{error}" if error.present?

    error if error.present?
  end

  private
    attr_reader :company_worker, :update_params
end
