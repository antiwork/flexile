# frozen_string_literal: true

RSpec.describe Admin::UsersController do
  let(:dashboard_path) { "#{PROTOCOL}://#{DOMAIN}/dashboard" }

  let(:team_member_user) { create(:user, team_member: true) }
  let(:another_team_member_user) { create(:user, team_member: true) }
  let(:non_team_member) { create(:user) }
  let(:user) { create(:user) }

  before do
    allow(controller).to receive(:current_context) do
      Current.authenticated_user = team_member_user
      CurrentContext.new(user: team_member_user, company: nil)
    end
  end

  describe "GET #impersonate" do
    def expect_access_denied
      expect(response).to redirect_to(admin_users_path)
      expect(flash[:alert]).to eq("The requested resource could not be accessed.")
    end

    it "allows impersonating regular users" do
      expect(controller).to receive(:reset_current)
      get :impersonate, params: { id: user.external_id }
      expect(response).to redirect_to(dashboard_path)
    end

    it "denies impersonating other team members" do
      get :impersonate, params: { id: another_team_member_user.external_id }
      expect_access_denied
    end

    it "denies impersonating non-existent users" do
      get :impersonate, params: { id: "non-existent-external-id" }
      expect_access_denied
    end

    context "when current user is not a team member" do
      before do
        allow(controller).to receive(:current_context) do
          Current.authenticated_user = non_team_member
          CurrentContext.new(user: non_team_member, company: nil)
        end
      end

      it "denies impersonating regular users" do
        expect(ImpersonationService).not_to receive(:new)
        get :impersonate, params: { id: user.external_id }
        expect(response).to redirect_to(dashboard_path)
      end
    end
  end

  describe "DELETE #unimpersonate" do
    it "ends impersonation session" do
      expect(controller).to receive(:reset_current)
      delete :unimpersonate
      expect(response.parsed_body[:success]).to be true
    end
  end
end
