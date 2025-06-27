# frozen_string_literal: true

RSpec.describe "shared/_contractor_invitation" do
  let(:company) { create(:company, name: "Test Company") }
  let(:inviter) { create(:user, legal_name: "Admin User") }
  let(:user) { create(:user, email: "contractor@example.com", legal_name: "Test Contractor", invited_by: inviter) }
  let(:url) { "https://example.com/invitation" }

  before do
    assign(:company, company)
    assign(:user, user)
  end

  context "when contractor has sentinel rate (rate to be determined)" do
    let(:contractor) { create(:company_worker, pay_rate_in_subunits: 1, company: company, user: user, role: "Developer") }

    before do
      assign(:contractor, contractor)
    end

    it "displays 'Rate to be determined' instead of $0.01/hr" do
      render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

      expect(rendered).to include("Rate to be determined")
      expect(rendered).not_to include("$0.01")
      expect(rendered).not_to include("$0/yr")
    end

    it "still displays other contractor information correctly" do
      render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

      expect(rendered).to include("Developer") # Role
      expect(rendered).to include(contractor.started_at.strftime("%B %d, %Y")) # Start date
    end

    context "when contractor is hourly" do
      let(:contractor) { create(:company_worker, :hourly, pay_rate_in_subunits: 1, company: company, user: user, hours_per_week: 20) }

      it "displays average hours even with sentinel rate" do
        render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

        expect(rendered).to include("20/week")
        expect(rendered).to include("Rate to be determined")
      end
    end

    context "when contractor is project-based" do
      let(:contractor) { create(:company_worker, :project_based, pay_rate_in_subunits: 1, company: company, user: user) }

      it "displays 'Rate to be determined' for project-based contractors" do
        render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

        expect(rendered).to include("Rate to be determined")
        expect(rendered).not_to include("$0.01 per project")
      end
    end
  end

  context "when contractor has normal rate" do
    context "when contractor is hourly" do
      let(:contractor) { create(:company_worker, :hourly, pay_rate_in_subunits: 50_00, company: company, user: user, hours_per_week: 40) }

      before do
        assign(:contractor, contractor)
      end

      it "displays the actual hourly rate and yearly estimate" do
        render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

        expect(rendered).to include("$50.0/hr")
        expect(rendered).to include("/yr")
        expect(rendered).not_to include("Rate to be determined")
      end
    end

    context "when contractor is project-based" do
      let(:contractor) { create(:company_worker, :project_based, pay_rate_in_subunits: 1000_00, company: company, user: user) }

      before do
        assign(:contractor, contractor)
      end

      it "displays the actual project rate" do
        render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

        expect(rendered).to include("$1,000 per project")
        expect(rendered).not_to include("Rate to be determined")
      end
    end
  end

  context "edge cases" do
    context "when contractor has $0.02 rate (just above sentinel)" do
      let(:contractor) { create(:company_worker, pay_rate_in_subunits: 2, company: company, user: user) }

      before do
        assign(:contractor, contractor)
      end

      it "displays the actual rate, not 'Rate to be determined'" do
        render partial: "shared/contractor_invitation", locals: { contractor: contractor, company: company, user: user, url: url }

        expect(rendered).to include("$0.02/hr")
        expect(rendered).not_to include("Rate to be determined")
      end
    end
  end
end