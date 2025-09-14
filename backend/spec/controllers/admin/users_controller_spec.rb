# frozen_string_literal: true

RSpec.describe Admin::UsersController do
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

  describe "GET #impersonate" do
    context "when authenticated as team member" do
      context "when target user exists and is not a team member" do
        it "redirects to impersonation URL" do
          get :impersonate, params: { id: target_user.id }

          expect(response).to have_http_status(:redirect)
          expect(response.location).to include("actor_token=")
        end
      end

      context "when trying to impersonate another team member" do
        it "redirects to admin users path with alert" do
          get :impersonate, params: { id: another_team_member.id }

          expect(response).to redirect_to(admin_users_path)
          expect(flash[:alert]).to eq("The requested resource could not be accessed")
        end
      end

      context "when target user does not exist" do
        it "redirects to admin users path with alert" do
          get :impersonate, params: { id: 999999 }

          expect(response).to redirect_to(admin_users_path)
          expect(flash[:alert]).to eq("The requested resource could not be accessed")
        end
      end

      context "when trying to impersonate themselves" do
        it "redirects to admin users path with alert" do
          get :impersonate, params: { id: team_member.id }

          expect(response).to redirect_to(admin_users_path)
          expect(flash[:alert]).to eq("The requested resource could not be accessed")
        end
      end
    end
  end
end
