# frozen_string_literal: true

RSpec.describe Internal::Companies::Administrator::OptionPoolsController do
  let(:company) { create(:company, equity_enabled: true) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: user) }
  let(:share_class) { create(:share_class, company: company, name: "Common") }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: user, company: company)
    end
  end

  describe "POST #create" do
    context "when authorized" do
      before { company_administrator }

      it "creates an option pool via service and returns JSON" do
        expect(CreateOptionPool).to receive(:new) do |args|
          expect(args[:company]).to eq(company)
          expect(args[:name]).to eq("2025 Equity plan")
          expect(args[:authorized_shares]).to eq("1000000")
          expect(args[:share_class]).to eq(share_class)
          double(process: { success: true, option_pool: instance_double(OptionPool) })
        end

        post :create, params: {
          company_id: company.external_id,
          option_pool: {
            name: "2025 Equity plan",
            authorized_shares: 1_000_000,
            share_class_id: share_class.id,
            default_option_expiry_months: 120,
            voluntary_termination_exercise_months: 120,
            involuntary_termination_exercise_months: 120,
            termination_with_cause_exercise_months: 0,
            death_exercise_months: 120,
            disability_exercise_months: 120,
            retirement_exercise_months: 120,
          },
        }

        expect(response).to have_http_status(:ok)
      end

      it "returns error when service fails" do
        expect(CreateOptionPool).to receive(:new).and_return(double(process: { success: false, error: "error" }))

        post :create, params: {
          company_id: company.external_id,
          option_pool: {
            name: "abc",
            authorized_shares: 10,
            share_class_id: share_class.id,
            default_option_expiry_months: 120,
            voluntary_termination_exercise_months: 120,
            involuntary_termination_exercise_months: 120,
            termination_with_cause_exercise_months: 0,
            death_exercise_months: 120,
            disability_exercise_months: 120,
            retirement_exercise_months: 120,
          },
        }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body).to include("error" => "error")
      end
    end

    context "when unauthorized" do
      before { company_administrator.destroy! }

      it "forbids access" do
        post :create, params: { company_id: company.external_id, option_pool: { name: "x", authorized_shares: 10, share_class_id: share_class.id } }
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
