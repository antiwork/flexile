# frozen_string_literal: true

include ActiveJob::TestHelper

RSpec.describe InviteAdministrator do
  let!(:company) { create(:company, :completed_onboarding) }
  let(:email) { "admin@example.com" }
  let!(:current_user) { create(:user) }

  subject(:invite_administrator) { described_class.new(company:, email:, current_user:).perform }

  before(:each) do
    clear_enqueued_jobs
    ActionMailer::Base.deliveries.clear
  end

  describe "#perform" do
    context "email normalization" do
      let(:email) { "ADmIN@EXAMPLE.COM" }

      it "when creating user and sending email", :vcr do
        result = invite_administrator
        perform_enqueued_jobs

        expect(result[:success]).to be true
        user = User.last
        expect(user.email).to eq("admin@example.com")

        sent_email = ActionMailer::Base.deliveries.last
        expect(sent_email.to).to eq(["admin@example.com"])
      end
    end

    context "error handling" do
      context "when company_administrator creation fails due to validation" do
        let!(:existing_user) { create(:user, email:) }
        let!(:existing_company_administrator) { create(:company_administrator, company:, user: existing_user) }

        it "handles uniqueness validation error correctly" do
          result = invite_administrator

          expect(result[:success]).to be false
          expect(result[:error_message]).to eq("Administrator account already exists for this email")
          expect(result[:field]).to eq(:email)
        end
      end

      context "when database constraint is violated" do
        it "returns appropriate error for company_administrators constraint" do
          existing_user = create(:user, email:)
          create(:company_administrator, company:, user: existing_user)

          result = nil
          expect do
            result = invite_administrator
          end.not_to change { ActionMailer::Base.deliveries.count }

          expect(result[:success]).to be false
          expect(result[:error_message]).to eq("Administrator account already exists for this email")
          expect(result[:field]).to eq(:email)
        end
      end

      context "when user creation fails" do
        it "returns appropriate error message and does not send email" do
          invalid_user = build(:user, email: "invalid-email")
          invalid_user.errors.add(:email, "is invalid")

          allow(User).to receive(:find_or_create_by!)
            .and_raise(ActiveRecord::RecordInvalid.new(invalid_user))

          result = nil
          expect do
            result = invite_administrator
          end.not_to change(ActionMailer::Base.deliveries, :count)

          expect(result[:success]).to be false
          expect(result[:error_message]).to include("Email is invalid")
          expect(result[:field]).to eq(:email)
        end
      end
    end

    context "transaction behavior" do
      it "rolls back user creation and does not send email when company_administrator creation fails" do
        existing_user = create(:user, email:)
        create(:company_administrator, company:, user: existing_user)

        expect { invite_administrator }.not_to change(User, :count)
        expect(enqueued_jobs).to be_empty
      end
    end

    context "when inviting a new user" do
      it "creates a new user and company_administrator with correct attributes", :vcr do
        result = nil
        expect do
          result = invite_administrator
          perform_enqueued_jobs
        end.to change(User, :count).by(1)
          .and change(CompanyAdministrator, :count).by(1)
          .and change { ActionMailer::Base.deliveries.count }.by(1)

        expect(result[:success]).to be true

        user = User.last
        company_administrator = CompanyAdministrator.last
        expect(user.email).to eq(email)
        expect(company_administrator.company).to eq(company)
        expect(company_administrator.user).to eq(user)
        expect(user.invited_by).to eq(current_user)

        sent_email = ActionMailer::Base.deliveries.last
        expect(sent_email.to).to eq([email])
        expect(sent_email.subject).to eq("You've been invited to join #{company.name} as an administrator")
      end

      it "sends email with correct basic attributes", :vcr do
        invite_administrator
        perform_enqueued_jobs

        sent_email = ActionMailer::Base.deliveries.last
        expect(sent_email.to).to eq([email])
        expect(sent_email.subject).to include(company.name)
        expect(sent_email.reply_to).to eq([company.email])
      end

      it "sets skip_invitation on user invite", :vcr do
        expect_any_instance_of(User)
          .to receive(:invite!)
          .and_wrap_original do |original, user, *args|
            original.call(*args) do |invitation|
              expect(invitation).to respond_to(:skip_invitation=)
              invitation.skip_invitation = true
            end
          end

        invite_administrator
      end
    end

    context "when inviting an existing administrator" do
      let!(:existing_user) { create(:user, email:) }
      let!(:company_administrator) { create(:company_administrator, company:, user: existing_user) }

      it "returns an error and does not create new records or send emails" do
        result = nil
        expect do
          result = invite_administrator
        end.to not_change(User, :count)
          .and not_change(CompanyAdministrator, :count)
          .and not_change { ActionMailer::Base.deliveries.count }

        expect(result[:success]).to be false
        expect(result[:error_message]).to eq("Administrator account already exists for this email")
        expect(result[:field]).to eq(:email)
      end
    end
  end
end
