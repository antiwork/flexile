# frozen_string_literal: true

RSpec.describe InviteAdmin do
  let!(:company) { create(:company, :completed_onboarding) }
  let(:email) { "admin@example.com" }
  let!(:current_user) { create(:user) }

  subject(:invite_admin) { described_class.new(company:, email:, current_user:).perform }

  context "when inviting a new user" do
    it "creates a new user and company_administrator with correct attributes", :vcr do
      result = nil
      expect do
        result = invite_admin
      end.to change(User, :count).by(1)
         .and change(CompanyAdministrator, :count).by(1)
         .and have_enqueued_mail(CompanyAdministratorMailer, :invitation_instructions)

      expect(result[:success]).to be true

      user = User.last
      company_administrator = CompanyAdministrator.last

      expect(user.email).to eq(email)
      expect(company_administrator.company).to eq(company)
      expect(company_administrator.user).to eq(user)
      expect(user.invited_by).to eq(current_user)
    end
  end

  context "when inviting an existing user" do
    let!(:company_administrator) { create(:company_administrator, company:, user: create(:user, email:)) }

    it "returns an error and does not create new records or send emails" do
      result = nil
      expect do
        result = invite_admin
      end.not_to have_enqueued_mail(CompanyAdministratorMailer, :invitation_instructions)

      expect(result[:success]).to be false
      expect(result[:error_message]).to eq("Email has already been taken")
      expect(result[:field]).to eq("email")
    end
  end
end
