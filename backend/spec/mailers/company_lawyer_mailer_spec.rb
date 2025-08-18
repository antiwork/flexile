# frozen_string_literal: true

RSpec.describe CompanyLawyerMailer do
  describe "#invitation_instructions" do
    let(:company) { create(:company, name: "Gumroad Inc.", email: "hi@flexile.com") }
    let(:user) { create(:user, email: "lawyer@example.com") }
    let(:company_lawyer) { create(:company_lawyer, company: company, user: user) }

    subject(:mail) { described_class.invitation_instructions(lawyer_id: company_lawyer.id) }

    context "when company_lawyer exists" do
      it "sends invitation email with correct attributes" do
        expect(mail.to).to eq([user.email])
        expect(mail.subject).to eq("You've been invited to join #{company.name} as a lawyer")
        expect(mail.reply_to).to eq([company.email])
        expect(mail.from).to eq([Rails.application.config.action_mailer.default_options[:from]])
        expect(mail.content_type).to include("text/html")
        expect(mail.body.decoded).to include(company.name)
        expect(mail.body.decoded).to include(SIGNUP_URL)
      end
    end

    context "when company_lawyer lookup fails" do
      it "handles invalid lawyer_id gracefully" do
        expect do
          described_class.invitation_instructions(lawyer_id: 999999).deliver_now
        end.not_to change { ActionMailer::Base.deliveries.count }
      end

      it "handles nil lawyer_id gracefully" do
        expect do
          described_class.invitation_instructions(lawyer_id: nil).deliver_now
        end.not_to change { ActionMailer::Base.deliveries.count }
      end
    end
  end
end
