# frozen_string_literal: true

require "spec_helper"

RSpec.describe User::OtpAuthentication, type: :model do
  let(:user) { create(:user) }

  describe "#verify_otp" do
    context "when in test environment with PLAYWRIGHT_TEST=true" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
        ENV["PLAYWRIGHT_TEST"] = "true"
      end

      after do
        ENV.delete("PLAYWRIGHT_TEST")
      end

      it 'accepts "000000" as valid OTP code' do
        expect(user.verify_otp("000000")).to be true
      end

      it "still validates normal OTP codes" do
        # Mock the normal OTP validation
        allow(user).to receive(:authenticate_otp).and_return(true)

        expect(user.verify_otp("123456")).to be true
        expect(user).to have_received(:authenticate_otp).with("123456", drift: User::OtpAuthentication::OTP_DRIFT)
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
        allow(user).to receive(:authenticate_otp).and_return(false)

        expect(user.verify_otp("000000")).to be false
        expect(user).to have_received(:authenticate_otp).with("000000", drift: User::OtpAuthentication::OTP_DRIFT)
      end
    end

    context "when PLAYWRIGHT_TEST is not set" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
        ENV.delete("PLAYWRIGHT_TEST")
      end

      it 'does not accept "000000" as valid OTP code' do
        allow(user).to receive(:authenticate_otp).and_return(false)

        expect(user.verify_otp("000000")).to be false
        expect(user).to have_received(:authenticate_otp).with("000000", drift: User::OtpAuthentication::OTP_DRIFT)
      end
    end
  end
end
