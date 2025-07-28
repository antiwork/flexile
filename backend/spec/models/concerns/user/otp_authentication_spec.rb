# frozen_string_literal: true

require "spec_helper"

RSpec.describe User::OtpAuthentication, type: :model do
  let(:user) { create(:user) }

  describe "#verify_otp" do
    context "when in test environment with PLAYWRIGHT_TEST=true" do
      before do
        ENV["PLAYWRIGHT_TEST"] = "true"
      end

      after do
        ENV.delete("PLAYWRIGHT_TEST")
      end

      it 'accepts "000000" as valid OTP code' do
        expect(user.verify_otp("000000")).to be true
      end

      it "still validates normal OTP codes" do
        expect(user.verify_otp(user.otp_code)).to be true
      end
    end

    context "when not in test environment" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
        ENV["PLAYWRIGHT_TEST"] = "true"
      end

      after do
        ENV.delete("PLAYWRIGHT_TEST")
      end

      it 'does not accept "000000" as valid OTP code' do
        expect(user.verify_otp("000000")).to be false
      end
    end

    context "when PLAYWRIGHT_TEST is not set" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
        ENV.delete("PLAYWRIGHT_TEST")
      end

      it 'does not accept "000000" as valid OTP code' do
        expect(user.verify_otp("000000")).to be false
      end
    end
  end
end
