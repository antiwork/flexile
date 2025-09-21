# frozen_string_literal: true

RSpec.describe Internal::Companies::InvestorEntitiesController do
  let(:company) { create(:company, equity_enabled: true) }
  let(:admin_user) { create(:user) }
  let(:regular_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:investor_entity) { create(:company_investor_entity, company: company) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)
    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      Current.company_lawyer = nil
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "GET #show" do
    context "when user is authorized" do
      it "returns investor entity data" do
        get :show, params: { company_id: company.external_id, id: investor_entity.external_id }

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response).to include("id", "name", "grants", "shares")
        expect(json_response["id"]).to eq(investor_entity.external_id)
      end

      context "when investor entity does not exist" do
        it "returns not found" do
          get :show, params: { company_id: company.external_id, id: "nonexistent" }

          expect(response).to have_http_status(:not_found)
          expect(response.parsed_body["error"]).to eq("Investor entity not found")
        end
      end
    end

    context "when user is not authorized" do
      before { company_administrator.destroy! }

      it "returns forbidden" do
        get :show, params: { company_id: company.external_id, id: investor_entity.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when equity is not enabled" do
      let(:company) { create(:company, equity_enabled: false) }

      it "returns forbidden" do
        get :show, params: { company_id: company.external_id, id: investor_entity.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
