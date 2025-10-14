# frozen_string_literal: true

RSpec.describe Internal::CurrentUsersController do
  let(:user) { create(:user) }
  let(:company) { create(:company) }
  let(:company_administrator) { create(:company_administrator, company:, user:) }

  describe "GET #show" do
    context "when authenticated" do
      before do
        allow(controller).to receive(:current_context) do
          Current.user = user
          Current.company = company
          Current.company_administrator = company_administrator
          CurrentContext.new(user:, company:)
        end
      end

      it "returns presented logged in user data" do
        get :show

        expect(response).to have_http_status(:ok)
        body = response.parsed_body

        expect(body["id"]).to eq(user.external_id)
        expect(body["currentCompanyId"]).to eq(company.external_id)
        expect(body["email"]).to eq(user.display_email)
        expect(body["roles"]).to be_a(Hash)
        expect(body["companies"]).to be_a(Array)
      end
    end

    context "when unauthenticated" do
      it "returns 401 unauthorized" do
        get :show

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body).to include("success" => false, "error" => "Unauthorized")
      end
    end
  end
end
