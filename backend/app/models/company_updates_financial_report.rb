# frozen_string_literal: true

class CompanyUpdatesFinancialReport < ApplicationRecord
  belongs_to :company_update
  belongs_to :company_monthly_financial_report
end
