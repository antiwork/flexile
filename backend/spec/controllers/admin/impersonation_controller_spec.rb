# frozen_string_literal: true

RSpec.describe Admin::ImpersonationController do
  let(:team_member) { create(:user, team_member: true) }
  let(:non_team_member) { create(:user, team_member: false) }
  let(:target_user) { create(:user) }
  let(:another_team_member) { create(:user, team_member: true) }

  before do
    allow(controller).to receive(:current_context) do
      Current.user = team_member
      Current.company = nil
      Current.company_administrator = nil
      CurrentContext.new(user: team_member, company: nil)
    end
  end

  describe "POST #create" do
    context "when authenticated as team member" do
      context "when target user exists and is not a team member" do
        it "returns impersonation URL" do
          post :create, params: { email: target_user.email }

          expect(response).to have_http_status(:created)
          json_response = response.parsed_body
          expect(json_response["redirect_url"]).to be_present
          expect(json_response["redirect_url"]).to include("actor_token=")
        end
      end

      context "when trying to impersonate another team member" do
        it "returns forbidden" do
          post :create, params: { email: another_team_member.email }

          expect(response).to have_http_status(:forbidden)
          json_response = response.parsed_body
          expect(json_response["error"]).to eq("You are not allowed to perform this action.")
        end
      end

      context "when target user does not exist" do
        it "returns not found" do
          post :create, params: { email: "nonexistent@flexile.com" }

          expect(response).to have_http_status(:not_found)
          json_response = response.parsed_body
          expect(json_response["error_message"]).to eq("User not found")
        end
      end

      context "when trying to impersonate themselves" do
        it "returns unprocessable entity" do
          post :create, params: { email: team_member.email }

          expect(response).to have_http_status(:unprocessable_entity)
          json_response = response.parsed_body
          expect(json_response["error_message"]).to eq("Nice try, but you can't impersonate yourself!")
        end
      end
    end

    context "when not authenticated as team member" do
      before do
        allow(controller).to receive(:current_context) do
          Current.user = non_team_member
          Current.company = nil
          Current.company_administrator = nil
          CurrentContext.new(user: non_team_member, company: nil)
        end
      end

      it "raises routing error" do
        expect do
          post :create, params: { email: target_user.email }
        end.to raise_error(ActionController::RoutingError, "Not Found")
      end
    end
  end
end
