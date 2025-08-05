# frozen_string_literal: true

RSpec.describe CompanyAdministratorMailer do
  describe "#invitation_instructions" do
    let(:company) { create(:company, name: "Gumroad Inc.", email: "hi@flexile.com") }
    let(:user) { create(:user, email: "admin@example.com") }
    let(:company_administrator) { create(:company_administrator, company: company, user: user) }

    subject(:mail) { described_class.invitation_instructions(admin_id: company_administrator.id) }

    context "when company_administrator exists" do
      it "sends invitation email with correct attributes" do
        expect(mail.to).to eq([user.email])
        expect(mail.subject).to eq("You've been invited to join #{company.name} as an administrator")
        expect(mail.reply_to).to eq([company.email])
        expect(mail.from).to eq([Rails.application.config.action_mailer.default_options[:from]])
        expect(mail.content_type).to include("text/html")
        expect(mail.body.decoded).to include(company.name)
        expect(mail.body.decoded).to include(SIGNUP_URL)
      end
    end

    context "when company_administrator lookup fails" do
      it "handles invalid admin_id gracefully" do
        expect do
          described_class.invitation_instructions(admin_id: 999999).deliver_now
        end.not_to change { ActionMailer::Base.deliveries.count }
      end

      it "handles nil admin_id gracefully" do
        expect do
          described_class.invitation_instructions(admin_id: nil).deliver_now
        end.not_to change { ActionMailer::Base.deliveries.count }
      end
    end
  end
end
