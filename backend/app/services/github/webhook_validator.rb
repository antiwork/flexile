# frozen_string_literal: true

class Github::WebhookValidator
  def initialize(signature_header, webhook_body)
    @signature_header = signature_header
    @webhook_body = webhook_body
  end

  def valid?
    return false if @signature_header.blank? || @webhook_body.blank?

    endpoint_secret = GlobalConfig.get("GH_WEBHOOK_SECRET")
    hmac = "sha256=#{OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new("sha256"), endpoint_secret, @webhook_body)}"
    ActiveSupport::SecurityUtils.secure_compare(hmac.strip, @signature_header.strip)
  end
end
