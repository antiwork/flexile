# frozen_string_literal: true

RSpec.describe Wise::WebhookValidator do
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

      rsa_double = double("OpenSSL::PKey::RSA")
      allow(OpenSSL::PKey::RSA).to receive(:new).with(described_class::PUBLIC_KEY).and_return(rsa_double)
      allow(rsa_double).to receive(:verify).with(OpenSSL::Digest::SHA256.new, Base64.decode64(signature), webhook_body).and_return(true)

      result = described_class.new(signature, webhook_body).valid?
      expect(result).to eq(true)
    end
  end
end
