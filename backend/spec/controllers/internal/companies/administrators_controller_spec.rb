# frozen_string_literal: true

RSpec.describe Internal::Companies::AdministratorsController, type: :controller do
  let!(:company) { create(:company, :completed_onboarding) }
  let!(:company_administrator) { create(:company_administrator, company:) }
  let!(:user) { company_administrator.user }

  before do
    sign_in user
    allow(controller).to receive(:current_company).and_return(company)
    allow(controller).to receive(:current_user).and_return(user)
  end

  describe "POST #create" do
    let(:email) { "newadmin@example.com" }

    context "when successful" do
      it "returns success response" do
        post :create, params: { email: }

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)).to eq({ "success" => true })
      end
    end

    context "when unsuccessful" do
      let(:email) { "existing@example.com" }
      let!(:existing_user) { create(:user, email:) }
      let!(:existing_admin) { create(:company_administrator, company:, user: existing_user) }

      it "returns error response" do
        post :create, params: { email: }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(JSON.parse(response.body)).to include(
          "success" => false,
          "field" => "email",
          "error_message" => "Email has already been taken"
        )
      end
    end
  end
end
