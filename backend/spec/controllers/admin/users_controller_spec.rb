# frozen_string_literal: true

RSpec.describe Admin::UsersController do
  let(:team_member) { create(:user, team_member: true) }
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
    def expect_access_denied
      expect(response).to redirect_to(admin_users_path)
      expect(flash[:alert]).to eq("The requested resource could not be accessed")
    end

    it "succeeds for regular users" do
      get :impersonate, params: { id: target_user.id }

      expect(response).to have_http_status(:redirect)
      expect(response.location).to include("actor_token=")
    end

    it "denies impersonating team members" do
      get :impersonate, params: { id: another_team_member.id }
      expect_access_denied
    end

    it "denies impersonating self" do
      get :impersonate, params: { id: team_member.id }
      expect_access_denied
    end

    it "denies non-existent users" do
      get :impersonate, params: { id: 999999 }
      expect_access_denied
    end
  end
end
