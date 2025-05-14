# frozen_string_literal: true

class QuickbooksMonthlyFinancialReportSyncJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform
    company_ids_to_sync = Company.where.associated(:quickbooks_integration).ids

    return if company_ids_to_sync.empty?

    QuickbooksCompanyFinancialReportSyncJob.perform_bulk(company_ids_to_sync.zip)
  end
end
