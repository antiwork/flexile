# frozen_string_literal: true

class UserTaxFormReviewReminderEmailJob
  include Sidekiq::Worker
  sidekiq_options retry: 5

  def perform(user_compliance_info_id, company_id, tax_year = Date.current.year)
    user_compliance_info = UserComplianceInfo.joins(:user).merge(User.alive).find_by(id: user_compliance_info_id)
    return if user_compliance_info.nil?

    UserMailer.tax_form_review_reminder(user_compliance_info_id, company_id, tax_year).deliver_now
  end
end
