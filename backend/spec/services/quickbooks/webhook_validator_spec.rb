# frozen_string_literal: true

RSpec.describe Quickbooks::WebhookValidator do
  describe "#valid?" do
    it "returns `false` if either of the arguments are blank" do
      result = described_class.new("", "some body").valid?
      expect(result).to eq(false)

      result = described_class.new("some signature", "").valid?
      expect(result).to eq(false)
    end

    it "returns `false` when the webhook is not valid" do
      result = described_class.new("signature", "body").valid?
      expect(result).to eq(false)
    end

    it "returns `true` when the webhook is valid" do
      signature = "signature"
      webhook_body = "webhook body"

      hmac_double = double("OpenSSL::HMAC")
      allow(OpenSSL::HMAC).to receive(:digest).with(OpenSSL::Digest::SHA256.new, GlobalConfig.get("QUICKBOOKS_WEBHOOK_SECRET"), webhook_body).and_return(hmac_double)
      allow(ActiveSupport::SecurityUtils).to receive(:secure_compare).with(Base64.encode64("#{hmac_double}").strip, signature.strip).and_return(true)

      result = described_class.new(signature, webhook_body).valid?
      expect(result).to eq(true)
    end
  end
end
