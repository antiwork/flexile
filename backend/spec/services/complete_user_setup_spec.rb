# frozen_string_literal: true

require "spec_helper"

RSpec.describe CompleteUserSetup, type: :service do
  let(:email) { "test@example.com" }
  let(:ip_address) { "127.0.0.1" }
  let(:user) { create(:user, email: email) }

  describe "#perform" do
    it "creates a tos agreement" do
      CompleteUserSetup.new(user: user, ip_address: ip_address).perform

      expect(user.tos_agreements.count).to eq(1)
      expect(user.tos_agreements.first.ip_address).to eq(ip_address)
    end
  end
end
