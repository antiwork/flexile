# frozen_string_literal: true

class Quickbooks::WebhookValidator
  def initialize(signature, webhook_body)
    @signature = signature
    @webhook_body = webhook_body
  end

  def valid?
    return false if @signature.blank? || @webhook_body.blank?

    endpoint_secret = GlobalConfig.get("QUICKBOOKS_WEBHOOK_SECRET")
    hmac = OpenSSL::HMAC.digest(OpenSSL::Digest.new("sha256"), endpoint_secret, @webhook_body)
    ActiveSupport::SecurityUtils.secure_compare(Base64.encode64("#{hmac}").strip, @signature.strip)
  end
end
