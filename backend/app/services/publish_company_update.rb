# frozen_string_literal: true

# Makes a company update public and sends it to all active contractors and investors, unless
# it was previously published (send_at was set).
class PublishCompanyUpdate
  def initialize(company_update)
    @company = company_update.company
    @company_update = company_update
  end

  def perform!
    company_update.with_lock do
      break if company_update.sent_at.present?

      company_update.update!(sent_at: Time.current)
      CompanyUpdateEmailsJob.perform_async(company_update.external_id)
    end

    { success: true, company_update: }
  end

  private
    attr_reader :company, :company_update
end
