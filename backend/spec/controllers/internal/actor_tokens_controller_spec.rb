# frozen_string_literal: true

RSpec.describe Internal::ActorTokensController do
  let(:company) { create(:company) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: user) }
  let(:target_user) { create(:user) }

  before do
    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: user, company: company)
    end
  end

  describe "POST #create" do
    context "when authorized as primary admin" do
      before do
        company.update!(primary_admin: company_administrator)
      end

      it "can create token for another admin" do
        create(:company_administrator, company: company, user: target_user)
        post :create, params: { user_id: target_user.id }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["actor_token"]).to be_present
      end

      it "can create token for non-admin user in company" do
        worker_user = create(:user)
        create(:company_worker, company: company, user: worker_user)
        post :create, params: { user_id: worker_user.id }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["actor_token"]).to be_present
      end
    end

    context "when authorized as company administrator" do
      it "can create token for non-admin user in company (worker, lawyer, investor)" do
        worker_user = create(:user)
        create(:company_worker, company: company, user: worker_user)
        post :create, params: { user_id: worker_user.id }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["actor_token"]).to be_present
      end

      it "cannot create token for another admin" do
        admin_user = create(:user)
        create(:company_administrator, company: company, user: admin_user)
        post :create, params: { user_id: admin_user.id }

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when unauthorized" do
      it "returns forbidden for non-admin user" do
        Current.company_administrator = nil
        Current.user = create(:user)
        post :create, params: { user_id: target_user.id }

        expect(response).to have_http_status(:forbidden)
      end

      it "returns forbidden when target user not in company or is in another company" do
        external_user = create(:user)
        post :create, params: { user_id: external_user.id }

        expect(response).to have_http_status(:forbidden)

        other_company = create(:company)
        create(:company_worker, company: other_company, user: external_user)
        post :create, params: { user_id: external_user.id }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
