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
      user_ids = company.company_workers.active.pluck(:user_id) + company.company_investors.pluck(:user_id)
      user_ids.uniq.each_slice(BATCH_SIZE) do |batch_ids|
        array_of_args = batch_ids.map { [company_update.id, _1] }
        CompanyUpdateEmailJob.perform_bulk(array_of_args)
      end
    end

    { success: true, company_update: }
  end

  private
    BATCH_SIZE = 1_000

    attr_reader :company, :company_update
end
