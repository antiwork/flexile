# frozen_string_literal: true

class CompanyMonthlyFinancialReport < ApplicationRecord
  belongs_to :company

  validates :year, presence: true
  validates :month, presence: true
  validates :net_income_cents, presence: true
  validates :revenue_cents, presence: true

  validates :company_id, uniqueness: { scope: [:year, :month], message: "must have only one record per company, year, and month" }
end
