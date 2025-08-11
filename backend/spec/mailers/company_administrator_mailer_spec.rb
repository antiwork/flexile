# frozen_string_literal: true

RSpec.describe CompanyAdministratorMailer do
  describe "invitation_instructions" do
    let(:company) { create(:company, :completed_onboarding) }
    let(:user) { create(:user) }
    let(:company_administrator) { create(:company_administrator, company:, user:) }
    let(:url) { "https://example.com/signup" }
    let(:mail) { described_class.invitation_instructions(administrator_id: company_administrator.id, url:) }

    it "renders the headers" do
      expect(mail.subject).to eq("You've been invited to join #{company.name} as an administrator")
      expect(mail.to).to eq([user.email])
      expect(mail.reply_to).to eq([company.email])
      default_from_email = Mail::Address.new(described_class.default[:from]).address
      expect(mail.from).to eq([default_from_email])
    end

    it "renders the body with correct details" do
      body = mail.body.encoded
      expect(body).to include("You've been invited to join #{company.name} as an administrator")
      expect(body).to include("#{company.name} has invited you to join their administrative team on Flexile.")
      expect(body).to include("Accept invitation and set up account")
      expect(body).to include(url)
    end
  end
end
