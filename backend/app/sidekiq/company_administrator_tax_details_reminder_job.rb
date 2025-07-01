# frozen_string_literal: true

class CompanyAdministratorTaxDetailsReminderJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform
    CompanyAdministrator.joins(:company)
                        .where("companies.tax_id IS NULL or companies.phone_number IS NULL")
                        .find_each do |company_administrator|
      CompanyMailer.complete_tax_info(admin_id: company_administrator.id).deliver_later
    end
  end
end
