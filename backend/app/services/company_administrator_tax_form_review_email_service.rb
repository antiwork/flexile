# frozen_string_literal: true

class CompanyAdministratorTaxFormReviewEmailService
  def initialize(company_id, tax_year = Date.current.year - 1)
    @company  = Company.find(company_id)
    @tax_year = tax_year
  end

  def process
    return unless company.active?
    return unless company.completed_onboarding?

    company.company_administrators.ids.each do
      CompanyMailer.tax_form_review_reminder(company_administrator_id: _1, tax_year:).deliver_later
    end
  end

  private
    attr_reader :tax_year, :company
end
