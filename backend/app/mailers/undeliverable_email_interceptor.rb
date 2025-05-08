# frozen_string_literal: true

class UndeliverableEmailInterceptor
  UNDELIVERABLE_DOMAINS = [
    "flexile.example",
    "example.com",
    "example.org",
  ].freeze

  def self.delivering_email(message)
    return if Rails.env.test? || Rails.env.production?

    undeliverable_emails = find_undeliverable_emails(message)

    if undeliverable_emails.any?
      log_info_message(message.delivery_handler, undeliverable_emails)
      message.perform_deliveries = false
    end
  end

  private
    def self.find_undeliverable_emails(message)
      emails = (message.to || []) + (message.cc || []) + (message.bcc || [])
      emails.uniq.select { |email| undeliverable_email?(email) }
    end

    def self.undeliverable_email?(email)
      UNDELIVERABLE_DOMAINS.any? do |undeliverable_domain|
        email.split("@").last.end_with?(undeliverable_domain)
      end
    end

    def self.log_info_message(mailer_klass, undeliverable_emails)
      Rails.logger.info "Suppressed #{mailer_klass} to: #{undeliverable_emails.join(', ')}"
    end
end
