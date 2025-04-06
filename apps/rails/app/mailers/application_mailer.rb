# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  {
    NOREPLY_EMAIL: "noreply@#{DOMAIN}",
    SUPPORT_EMAIL: "support@#{DOMAIN}",
  }.each do |key, email|
    const_set(key, email)
    const_set("#{key}_WITH_NAME", email_address_with_name(email, "Flexile"))
  end

  default from: NOREPLY_EMAIL_WITH_NAME
  layout "mailer"
end
