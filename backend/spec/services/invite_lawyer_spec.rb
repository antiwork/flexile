# frozen_string_literal: true

RSpec.describe InviteLawyer do
  include ActiveJob::TestHelper

  let!(:company) { create(:company, :completed_onboarding) }
  let(:email) { "lawyer@example.com" }
  let!(:current_user) { create(:user) }
  subject(:invite_lawyer) { described_class.new(company:, email:, current_user:).perform }

  before(:each) do
    clear_enqueued_jobs
    ActionMailer::Base.deliveries.clear
  end

  describe "#perform" do
    context "when inviting existing company worker" do
      let(:email) { "existing+contractor@example.com" }
      let!(:existing_user) { create(:user, email:) }
      let!(:existing_company_worker) { create(:company_worker, company:, user: existing_user) }

      it "creates company_lawyer with correct attributes and sends email" do
        result = nil
        expect do
          result = invite_lawyer
          perform_enqueued_jobs
        end.to not_change(User, :count)
          .and change(CompanyLawyer, :count).by(1)
          .and change { ActionMailer::Base.deliveries.count }.by(1)

        expect(result[:success]).to be true

        company_lawyer = CompanyLawyer.last
        expect(company_lawyer.user).to eq(existing_user)
        expect(company_lawyer.user.email).to eq(email)
        expect(company_lawyer.company).to eq(company)
        expect(company_lawyer.user.invited_by).to eq(current_user)

        sent_email = ActionMailer::Base.deliveries.last
        expect(sent_email.to).to eq([email])
        expect(sent_email.subject).to eq("You've been invited to join #{company.name} as a lawyer")
        expect(sent_email.reply_to).to eq([company.email])
      end
    end

    context "when inviting existing lawyer" do
      let!(:existing_user) { create(:user, email:) }
      let!(:existing_company_lawyer) { create(:company_lawyer, company:, user: existing_user) }

      it "returns error and does not create records or send email" do
        result = nil
        expect do
          result = invite_lawyer
        end.to not_change(User, :count)
          .and not_change(CompanyLawyer, :count)
          .and not_change { ActionMailer::Base.deliveries.count }

        expect(result[:success]).to be false
        expect(result[:error_message]).to eq("Lawyer account already exists for this email")
        expect(result[:field]).to eq(:user_id)
      end
    end

    context "when inviting new user" do
      let(:email) { "   LaWyeR@EXAMPLE.COM  " }

      it "creates user and company_lawyer with correct attributes and sends email" do
        result = nil
        expect do
          result = invite_lawyer
          perform_enqueued_jobs
        end.to change(User, :count).by(1)
          .and change(CompanyLawyer, :count).by(1)
          .and change { ActionMailer::Base.deliveries.count }.by(1)

        expect(result[:success]).to be true

        user = User.last
        company_lawyer = CompanyLawyer.last
        expect(user.email).to eq("lawyer@example.com")
        expect(company_lawyer.company).to eq(company)
        expect(company_lawyer.user).to eq(user)
        expect(user.invited_by).to eq(current_user)

        sent_email = ActionMailer::Base.deliveries.last
        expect(sent_email.to).to eq(["lawyer@example.com"])
        expect(sent_email.subject).to eq("You've been invited to join #{company.name} as a lawyer")
        expect(sent_email.reply_to).to eq([company.email])
      end
    end
  end
end
