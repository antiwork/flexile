# frozen_string_literal: true

require "spec_helper"

RSpec.describe UserMailer, type: :mailer do
  let(:user) { create(:user) }

  describe "#otp_code" do
    let(:mail) { UserMailer.otp_code(user.id) }

    it "renders the headers" do
      expect(mail.subject).to eq("Your verification code for Flexile")
      expect(mail.to).to eq([user.email])
      expect(mail.from).to eq([ApplicationMailer::SUPPORT_EMAIL])
    end

    it "renders the body" do
      expect(mail.body.encoded).to include("Your verification code is")
      expect(mail.body.encoded).to include(user.otp_code)
      expect(mail.body.encoded).to include("This code will expire in 10 minutes")
    end

    it "includes the correct OTP code" do
      expected_otp = user.otp_code
      expect(mail.body.encoded).to include(expected_otp)
    end
  end
end
