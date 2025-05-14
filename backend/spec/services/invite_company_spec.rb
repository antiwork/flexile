# frozen_string_literal: true

RSpec.describe InviteCompany do
  let!(:worker) { create(:user, inviting_company: true) }
  let(:company_administrator_params) { { email: "test@example.com" } }
  let(:company_params) { { name: "Test Company" } }
  let(:company_worker_params) do
    {
      started_at: Date.today,
      pay_rate_in_subunits: 100_00,
      pay_rate_type: "hourly",
      hours_per_week: 40,
      role: "Developer",
    }
  end

  it "creates a new company and invites the administrator", :vcr do
    result = nil
    expect do
      result = described_class.new(
        company_administrator_params:,
        company_params:,
        company_worker_params:,
        worker:
      ).perform
    end.to change { Company.count }.by(1)
      .and change { User.count }.by(1)
      .and change { CompanyWorker.count }.by(1)
      .and change { CompanyAdministrator.count }.by(1)
      .and change { Document.count }.by(1)
      .and have_enqueued_job(ActionMailer::MailDeliveryJob).exactly(:once)

    expect(result[:success]).to eq(true)

    new_company = Company.last
    expect(new_company.name).to eq("Test Company")
    expect(new_company.email).to eq("test@example.com")
    expect(new_company.country_code).to eq("US")

    administrator = User.find_by(email: "test@example.com")
    expect(administrator).to be_present
    expect(administrator.invited_by).to eq(worker)

    company_administrator = new_company.company_administrators.find_by(user: administrator)
    expect(company_administrator).to be_present

    company_worker = CompanyWorker.last
    expect(company_worker.user).to eq(worker)
    expect(company_worker.company).to eq(new_company)
    expect(company_worker.role).to eq("Developer")
    expect(company_worker.started_at).to eq(Date.today)
    expect(company_worker.pay_rate_in_subunits).to eq(100_00)
    expect(company_worker.pay_rate_type).to eq("hourly")
    expect(company_worker.hours_per_week).to eq(40)

    contract = worker.documents.consulting_contract.first
    expect(contract.company).to eq(new_company)
    expect(contract.signatories).to match_array([worker, administrator])
  end

  context "when an error occurs" do
    it "returns an error message" do
      result = nil
      company_worker_params[:pay_rate_type] = "invalid_input"
      expect do
        result = described_class.new(
          company_administrator_params:,
          company_params:,
          company_worker_params:,
          worker:,
        ).perform
        puts result
      end.to not_change { Company.count }
        .and not_change { User.count }
        .and not_change { CompanyWorker.count }
        .and not_change { Document.count }

      expect(result).to eq({ success: false, errors: { "company_worker.pay_rate_type" => "Pay rate type is not included in the list" } })
    end
  end

  context "when the email has already been taken" do
    let!(:existing_user) { create(:user, email: "test@example.com") }

    it "returns an error message" do
      result = nil
      expect do
        result = described_class.new(
          company_administrator_params:,
          company_params:,
          company_worker_params:,
          worker:,
        ).perform
      end.to not_change { Company.count }
        .and not_change { User.count }
        .and not_change { CompanyWorker.count }
        .and not_change { Document.count }

      expect(result).to eq(
        {
          success: false,
          errors: {
            "user.email" => "The email is already associated with a Flexile account. Please ask them to invite you as a contractor instead.",
          },
        }
      )
    end
  end
end
