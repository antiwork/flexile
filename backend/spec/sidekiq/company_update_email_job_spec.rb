# frozen_string_literal: true

RSpec.describe CompanyUpdateEmailJob do
  describe "#perform" do
    let(:company) { create(:company, name: "TestCo", email: "admin@testco.com") }
    let(:user) { create(:user, email: "user@example.com") }
    let(:company_update) { create(:company_update, company: company, title: "Q1 Update") }

    it "sends company update email to the specified user" do
      expect do
        described_class.new.perform(company_update.id, user.id)
      end.to have_enqueued_mail(CompanyUpdateMailer, :update_published).with(
        company_update_id: company_update.id,
        user_id: user.id
      )
    end
  end
end
