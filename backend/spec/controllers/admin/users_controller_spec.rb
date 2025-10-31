# frozen_string_literal: true

RSpec.describe Admin::UsersController do
  let(:team_member_user) { create(:user, team_member: true) }
  let(:another_team_member_user) { create(:user, team_member: true) }
  let(:non_team_member) { create(:user) }
  let(:user) { create(:user) }
  let(:dashboard_path) { "#{PROTOCOL}://#{DOMAIN}/dashboard" }

  before do
    allow(controller).to receive(:current_context) do
      Current.authenticated_user = team_member_user
      CurrentContext.new(user: team_member_user, company: nil)
    end
  end

  def expect_impersonate(authenticated_user:, user:)
    service = ImpersonationService.new(authenticated_user)

    expect(ImpersonationService).to receive(:new).with(authenticated_user).and_return(service)
    expect(service).to receive(:impersonate).with(user).and_call_original
  end

  def expect_unimpersonate(authenticated_user:)
    service = ImpersonationService.new(authenticated_user)

    expect(ImpersonationService).to receive(:new).with(authenticated_user).and_return(service)
    expect(service).to receive(:unimpersonate).and_call_original
  end

  def expect_no_service_call
    expect(ImpersonationService).not_to receive(:new)
  end

  describe "GET #impersonate" do
    it "allows impersonating regular users" do
      expect_impersonate(authenticated_user: team_member_user, user: user)

      get :impersonate, params: { id: user.external_id }

      expect(response).to redirect_to(dashboard_path)
    end

    it "denies impersonating other team members" do
      expect_no_service_call

      get :impersonate, params: { id: another_team_member_user.external_id }

      expect(response).to redirect_to(admin_users_path)
      expect(flash[:alert]).to eq("The requested resource could not be accessed.")
    end

    it "denies impersonating non-existent users" do
      expect_no_service_call

      get :impersonate, params: { id: "non-existent-external-id" }

      expect(response).to redirect_to(admin_users_path)
      expect(flash[:alert]).to eq("The requested resource could not be accessed.")
    end

    context "when current user is not a team member" do
      before do
        allow(controller).to receive(:current_context) do
          Current.authenticated_user = non_team_member
          CurrentContext.new(user: non_team_member, company: nil)
        end
      end

      it "denies impersonation of any user" do
        expect_no_service_call

        get :impersonate, params: { id: user.external_id }

        expect(response).to redirect_to(dashboard_path)
      end
    end
  end

  describe "DELETE #unimpersonate" do
    before { get :impersonate, params: { id: user.external_id } }

    it "ends impersonation session" do
      expect_unimpersonate(authenticated_user: team_member_user)

      delete :unimpersonate

      expect(response.parsed_body[:success]).to be true
    end
  end
end
