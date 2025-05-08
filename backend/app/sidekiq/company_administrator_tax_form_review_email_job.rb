# frozen_string_literal: true

class CompanyAdministratorTaxFormReviewEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(company_id, tax_year = Date.current.year - 1)
    CompanyAdministratorTaxFormReviewEmailService.new(company_id, tax_year).process
  end
end
