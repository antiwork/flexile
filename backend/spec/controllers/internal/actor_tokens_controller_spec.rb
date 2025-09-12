# frozen_string_literal: true

RSpec.describe Internal::ActorTokensController do
  let(:company) { create(:company) }
  let(:external_company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:user) { create(:user) }
  let(:target_user) { create(:user) }
  let(:external_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company:, user: admin_user) }
  let(:company_worker) { create(:company_worker, company:, user:)  }
  let(:external_company_worker) { create(:company_worker, company: external_company, user: external_user) }

  before do
    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "POST #create" do
    context "when authorized as primary admin" do
      before do
        company.update!(primary_admin: company_administrator)
      end

      it "can create token for another admin" do
        create(:company_administrator, company: company, user: target_user)
        post :create, params: { user_id: target_user.external_id }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["actor_token"]).to be_present
      end

      it "can create token for non-admin user in company" do
        create(:company_worker, company: company, user: target_user)
        post :create, params: { user_id: target_user.external_id }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["actor_token"]).to be_present
      end
    end

    context "when authorized as company administrator" do
      it "can create token for non-admin user in company (contractor, lawyer, investor)" do
        create(:company_worker, company: company, user: target_user)
        post :create, params: { user_id: target_user.external_id }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["actor_token"]).to be_present
      end

      it "cannot create token for another admin" do
        create(:company_administrator, company: company, user: target_user)
        post :create, params: { user_id: target_user.external_id }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when authorized as company worker" do
      let!(:company_worker) { create(:company_worker, company:, user: target_user) }

      before do
        allow(controller).to receive(:current_context) do
          Current.company_administrator = nil
          Current.user = user
          Current.company = company
          CurrentContext.new(user: user, company: company)
        end
      end

      it "returns forbidden" do
        post :create, params: { user_id: target_user.external_id }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when target user is not in company" do
      it "returns not_found" do
        post :create, params: { user_id: external_user.external_id }

        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
