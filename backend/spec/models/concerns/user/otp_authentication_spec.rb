# frozen_string_literal: true

require "spec_helper"

RSpec.describe User::OtpAuthentication, type: :model do
  let(:user) { create(:user, email: "test@example.com") }

  describe "#verify_otp" do
    context "when in test environment with ENABLE_DEFAULT_OTP=true" do
      before do
        ENV["ENABLE_DEFAULT_OTP"] = "true"
      end

      after do
        ENV.delete("ENABLE_DEFAULT_OTP")
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
        ENV["ENABLE_DEFAULT_OTP"] = "true"
      end

      after do
        ENV.delete("ENABLE_DEFAULT_OTP")
      end

      it 'does not accept "000000" as valid OTP code' do
        expect(user.verify_otp("000000")).to be false
      end
    end

    context "when ENABLE_DEFAULT_OTP is not set" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
        ENV.delete("ENABLE_DEFAULT_OTP")
      end

      it 'does not accept "000000" as valid OTP code' do
        expect(user.verify_otp("000000")).to be false
      end
    end
  end
end
