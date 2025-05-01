# frozen_string_literal: true

RSpec.describe UpdateCompanyRoleService do
  let(:company) { create(:company) }
  let(:company_role) { create(:company_role, company: company) }
  let(:params) do
    {
      name: "Updated Role",
      capitalized_expense: 30,
    }
  end
  let(:rate_params) do
    {
      pay_rate_in_subunits: 15000,
    }
  end

  subject(:process_service) { described_class.new(role: company_role, params: params, rate_params: rate_params).process }

  describe "#process" do
    context "when update is successful" do
      it "updates the role and its rate" do
        expect(process_service[:success]).to be true
        expect(company_role.reload.attributes).to include(
          "name" => "Updated Role",
          "capitalized_expense" => 30,
        )
        expect(company_role.rate.pay_rate_in_subunits).to eq 15000
      end

      it "updates rates for contractors with the same rate only unless update_all_rates is true" do
        contractor = create(:company_worker, company: company, company_role: company_role, pay_rate_in_subunits: company_role.pay_rate_in_subunits)
        custom_contractor = create(:company_worker, company: company, company_role: company_role, pay_rate_in_subunits: 5000)

        process_service
        expect(contractor.reload.pay_rate_in_subunits).to eq 15000
        expect(custom_contractor.reload.pay_rate_in_subunits).to eq 5000

        params[:update_all_rates] = true
        described_class.new(role: company_role, params: params, rate_params: rate_params).process
        expect(contractor.reload.pay_rate_in_subunits).to eq 15000
        expect(custom_contractor.reload.pay_rate_in_subunits).to eq 15000
      end
    end

    context "when update fails" do
      before do
        company_role.errors.add(:base, "Update failed")
        allow(company_role).to receive(:save!).and_raise(ActiveRecord::RecordInvalid, company_role)
      end

      it "returns an error message" do
        expect(process_service[:success]).to be false
        expect(process_service[:error]).to eq "Validation failed: Update failed"
      end
    end
  end
end
