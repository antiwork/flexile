# frozen_string_literal: true

RSpec.describe InviteLawyer do
  let!(:company) { create(:company, :completed_onboarding) }
  let(:email) { "lawyer@example.com" }
  let!(:current_user) { create(:user) }

  subject(:invite_lawyer) { described_class.new(company:, email:, current_user:).perform }

  context "when inviting a new user" do
    it "creates a new user and company_lawyer with correct attributes", :vcr do
      result = nil
      expect do
        result = invite_lawyer
      end.to change(User, :count).by(1)
         .and change(CompanyLawyer, :count).by(1)
         .and have_enqueued_mail(CompanyLawyerMailer, :invitation_instructions)

      expect(result[:success]).to be true

      user = User.last
      company_lawyer = CompanyLawyer.last

      expect(user.email).to eq(email)
      expect(company_lawyer.company).to eq(company)
      expect(company_lawyer.user).to eq(user)
      expect(user.invited_by).to eq(current_user)
    end
  end

  context "when inviting an existing user" do
    let!(:company_lawyer) { create(:company_lawyer, company:, user: create(:user, email:)) }

    it "returns an error and does not create new records or send emails" do
      result = nil
      expect do
        result = invite_lawyer
      end.not_to have_enqueued_mail(CompanyLawyerMailer, :invitation_instructions)

      expect(result[:success]).to be false
      expect(result[:error_message]).to eq("Email has already been taken")
      expect(result[:field]).to eq("email")
    end
  end
end
