# frozen_string_literal: true

require "spec_helper"

RSpec.describe CompleteUserSetup, type: :service do
  let(:email) { "test@example.com" }
  let(:ip_address) { "127.0.0.1" }

  describe "#perform" do
    context "user without invite link" do
      let(:user) { create(:user, email: email, signup_invite_link: nil) }

      it "creates a tos agreement" do
        CompleteUserSetup.new(user: user, ip_address: ip_address).perform

        expect(user.tos_agreements.count).to eq(1)
        expect(user.tos_agreements.first.ip_address).to eq(ip_address)
      end

      it "creates a default company and makes user an administrator" do
        CompleteUserSetup.new(user: user, ip_address: ip_address).perform

        expect(user.company_administrators.count).to eq(1)
        company = user.company_administrators.first.company
        expect(company.email).to eq(user.email)
        expect(company.country_code).to eq("US")
        expect(company.default_currency).to eq("USD")
      end
    end

    context "user with invite link" do
      let(:company) { create(:company) }
      let(:invite_link) { create(:company_invite_link, company: company) }
      let(:user) { create(:user, email: email, signup_invite_link: invite_link) }

      it "creates a tos agreement" do
        CompleteUserSetup.new(user: user, ip_address: ip_address).perform

        expect(user.tos_agreements.count).to eq(1)
        expect(user.tos_agreements.first.ip_address).to eq(ip_address)
      end

      it "does not create a default company" do
        CompleteUserSetup.new(user: user, ip_address: ip_address).perform

        expect(user.company_administrators).to be_empty
      end
    end
  end
end
