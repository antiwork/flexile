# frozen_string_literal: true

class CompanyWorkerTaxInfoReminderEmailJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(tax_year = Date.current.year - 1)
    CompanyWorkerReminderEmailService.new.confirm_tax_info_reminder(tax_year:)
  end
end
