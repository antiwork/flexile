# frozen_string_literal: true

class CreateOrUpdateCompanyUpdate
  def initialize(company:, company_update_params:, company_update: nil)
    @company = company
    @company_update = company_update.presence || company.company_updates.new
    @company_update_params = company_update_params
  end

  def perform!
    company_update.assign_attributes(
      company_update_params.except(:show_revenue, :show_net_income)
    )

    reports = find_reports(period_started_on: company_update.period_started_on, period: company_update.period)
    company_update.company_monthly_financial_reports = reports
    if reports.present?
      company_update.show_revenue = company_update_params[:show_revenue]
      company_update.show_net_income = company_update_params[:show_net_income]
    else
      # Reset flags to false if not all reports are available, even if they were
      # set as true
      company_update.show_revenue = false
      company_update.show_net_income = false
    end
    company_update.save!

    { success: true, company_update: }
  end

  private
    attr_reader :company, :company_update_params, :company_update

    def find_reports(period_started_on:, period:)
      return [] if period_started_on.blank?

      reports = company.company_monthly_financial_reports.where(year: period_started_on.year)
      reports = \
        case period
        when CompanyUpdate.periods[:month]
          reports.where(month: period_started_on.month)
        when CompanyUpdate.periods[:quarter]
          reports.where(month: (period_started_on.month..period_started_on.end_of_quarter.month).to_a)
        when CompanyUpdate.periods[:year]
          reports
        end

      reports.count == CompanyUpdate.months_for_period(period) ? reports : []
    end
end
