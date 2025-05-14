# frozen_string_literal: true

class UserTaxFormReviewReminderEmailJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(user_compliance_info_id, company_id, tax_year = Date.current.year)
    UserMailer.tax_form_review_reminder(user_compliance_info_id, company_id, tax_year).deliver_now
  end
end
