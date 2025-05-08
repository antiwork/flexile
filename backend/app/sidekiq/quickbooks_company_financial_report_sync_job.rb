# frozen_string_literal: true

class QuickbooksCompanyFinancialReportSyncJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id)
    company = Company.find(company_id)
    integration = company.quickbooks_integration
    return unless integration&.status_active?

    result = IntegrationApi::Quickbooks.new(company_id:).fetch_company_financials

    CompanyMonthlyFinancialReport.upsert(
      {
        year: 1.month.ago.year,
        month: 1.month.ago.month,
        company_id:,
        revenue_cents: result[:revenue] * 100,
        net_income_cents: result[:net_income] * 100,
      }
    )
  end
end
