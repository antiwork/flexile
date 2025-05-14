# frozen_string_literal: true

class UserMailerPreview < ActionMailer::Preview
  def tax_id_validation_failure
    UserMailer.tax_id_validation_failure(User.last.id)
  end

  def tax_id_validation_success
    UserMailer.tax_id_validation_success(User.last.id)
  end

  def tax_form_review_reminder
    UserMailer.tax_form_review_reminder(UserComplianceInfo.alive.last.id, Company.active.last.id, Date.today.year - 1)
  end
end
