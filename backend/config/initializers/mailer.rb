# frozen_string_literal: true

case Rails.env
when "test"
  Rails.application.config.action_mailer.delivery_method = :test
when "development", "staging", "production"
  Rails.application.config.action_mailer.delivery_method = :resend
  Resend.api_key = ENV.fetch("RESEND_API_KEY")
end
