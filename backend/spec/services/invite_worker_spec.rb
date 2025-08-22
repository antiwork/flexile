# frozen_string_literal: true

RSpec.describe InviteWorker do
  let(:email) { generate(:email) }
  let(:yesterday) { Date.yesterday }
  let(:company) do
    create(:company, name: "Gumroad", street_address: "548 Market Street", city: "San Francisco",
                     state: "CA", zip_code: "94104-5401", country_code: "US")
  end
  let(:worker_params) do
    {
      email:,
      started_at: yesterday,
      role: "Role",
      pay_rate_in_subunits: 50_00,
    }
  end
  let(:current_user) { create(:user, email: "flexi.bob@example.org", legal_name: "Flexi Bob") }
  let!(:company_administrator) { create(:company_administrator, company:, user: current_user) }

  subject(:invite_contractor) do
    described_class.new(current_user:, company:, company_administrator:, worker_params:).perform
  end

  it "creates the record when all information is present" do
    expect do
      expect(invite_contractor).to eq({ success: true, company_worker: CompanyWorker.last, document: Document.last })
    end.to change { User.count }.by(1)
        .and change { CompanyWorker.count }.by(1)
        .and change { Document.count }.by(1)
        .and have_enqueued_job(ActionMailer::MailDeliveryJob).exactly(0).times

    expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(CompanyWorker.last.id, false)

    user = User.last
    expect(user.email).to eq(email)
    expect(user.invited_by).to eq(current_user)

    contractor = CompanyWorker.last
    expect(contractor.started_at).to eq(yesterday)
    expect(contractor.pay_rate_in_subunits).to eq(50_00)
    expect(contractor.role).to eq("Role")

    contract = user.documents.consulting_contract.first
    expect(contract.company).to eq(company)
    expect(contract.signatories.sole).to eq user
  end

  context "when a user with the same email address already exists" do
    let(:user) { create(:user, email:) }

    context "when the user is a non-alumni contractor for the company" do
      let!(:company_worker) { create(:company_worker, user:, company:) }

      it "returns an error" do
        expect do
          expect(invite_contractor).to eq({ success: false, error_message: "Invitee is already working for this company." })
        end.to change { User.count }.by(0)
          .and change { CompanyWorker.count }.by(0)
          .and change { Document.count }.by(0)
      end

      context "when the worker hasn't completed onboarding" do
        before do
          user.update!(legal_name: nil)
        end

        it "resends the invitation email and returns an error" do
          expect do
            expect(invite_contractor).to eq(
              { success: false, error_message: "Invitee is already working for this company. A new invitation email has been sent." }
            )
          end.to change { User.count }.by(0)
            .and change { CompanyWorker.count }.by(0)
            .and change { Document.count }.by(0)
          expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(company_worker.id)
        end
      end
    end

    context "when the user is a contractor for another company" do
      let(:other_company) { create(:company, :completed_onboarding) }
      let!(:other_company_worker) { create(:company_worker, user:, company: other_company) }
      let(:other_admin_user) { other_company.primary_admin.user }

      before do
        user.invite!(other_admin_user) { |u| u.skip_invitation = true }
      end

      it "creates a new contractor record for this company" do
        expect do
          expect(invite_contractor).to eq({ success: true, company_worker: CompanyWorker.last, document: Document.last })
        end.to change { User.count }.by(0)
          .and change { CompanyWorker.count }.by(1)
          .and change { Document.count }.by(1)
          .and change { user.reload.invited_by }.from(other_admin_user).to(current_user)

        expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(CompanyWorker.last.id, true)

        contractor = CompanyWorker.last
        expect(contractor.user).to eq(user)
        expect(contractor.company).to eq(company)
        expect(contractor.started_at).to eq(yesterday)
        expect(contractor.pay_rate_in_subunits).to eq(50_00)
        expect(contractor.role).to eq("Role")
      end
    end

    it "reactivates the alumnus contractor record of the user for the same company" do
      company_worker = create(
        :company_worker,
        user:,
        company:,
        ended_at: 3.months.ago,
        pay_rate_in_subunits: 100_00
      )

      expect do
        expect(invite_contractor).to eq({ success: true, company_worker: company_worker, document: Document.last })
      end.to change { User.count }.by(0)
          .and change { CompanyWorker.count }.by(0)
          .and change { Document.count }.by(1)
          .and change { user.reload.invited_by }.from(nil).to(current_user)
      expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(CompanyWorker.last.id, true)

      company_worker.reload
      expect(company_worker.started_at).to eq(yesterday)
      expect(company_worker.ended_at).to eq(nil)
      expect(company_worker.pay_rate_in_subunits).to eq(50_00)
      expect(company_worker.role).to eq("Role")
    end
  end

  context "when contractor details are invalid" do
    let(:worker_params) do
      {
        email:,
        started_at: yesterday,
        pay_rate_in_subunits: -50_00,
        role: "",
      }
    end

    it "returns contractor specific validation error messages" do
      expect do
        expect(invite_contractor).to eq({ success: false, error_message: "Please enter a rate above $0." })
      end.to change { User.count }.by(0)
         .and change { CompanyWorker.count }.by(0)
         .and change { Document.count }.by(0)
    end
  end
end
