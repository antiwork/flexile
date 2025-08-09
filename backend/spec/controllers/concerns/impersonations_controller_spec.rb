# frozen_string_literal: true

require "spec_helper"

RSpec.describe Admin::ImpersonationsController, type: :controller do
  let!(:team_member) { FactoryBot.create(:user, team_member: true) }
  let!(:user) { FactoryBot.create(:user, team_member: false) }

  before do
    allow(JwtService).to receive(:token_present_in_request?).and_return(true)
    allow(JwtService).to receive(:user_from_request).and_return(team_member)
  end

  def decoded_user_id_from_cookie
    cookie_val = cookies["x-flexile-auth"] || response.cookies["x-flexile-auth"]
    if cookie_val.blank?
      set_cookie = Array(response.headers["Set-Cookie"]).find { |c| c.start_with?("x-flexile-auth=") }
      if set_cookie
        name_value = set_cookie.split(";", 2).first
        cookie_val = name_value.split("=", 2)[1]
      end
    end
    return nil if cookie_val.blank?
    token = cookie_val.split(" ").last
    JwtService.user_from_token(token)&.id
  end

  describe "GET #create" do
    context "with a valid token" do
      let(:valid_token) { user.signed_id(expires_in: 5.minutes, purpose: :impersonate) }

      it "impersonates the user" do
        get :create, params: { token: valid_token }
        expect(session[:user_id]).to eq(user.id)
        expect(session[:impersonator_id]).to eq(team_member.id)
        expect(flash[:notice]).to eq("Now impersonating #{user.email}")
        expect(response).to redirect_to(admin_root_path)
        expect(decoded_user_id_from_cookie).to eq(user.id)
      end
    end

    context "with an invalid token" do
      it "does not impersonate the user" do
        get :create, params: { token: "invalid-token" }
        expect(session[:impersonator_id]).to be_nil
        expect(session[:user_id]).to be_nil
        expect(flash[:alert]).to eq("Invalid or expired impersonation link.")
        expect(response).to redirect_to(admin_root_path)
        expect(decoded_user_id_from_cookie).to be_nil
      end
    end
  end

  describe "DELETE #destroy" do
    context "when impersonating a user" do
      before do
        session[:user_id] = user.id
        session[:impersonator_id] = team_member.id
      end

      it "stops impersonating and reverts to the original user" do
        delete :destroy, params: { id: 0 }
        expect(session[:user_id]).to eq(team_member.id)
        expect(session[:impersonator_id]).to be_nil
        expect(flash[:notice]).to eq("Stopped impersonating.")
        expect(response).to redirect_to(admin_root_path)
        expect(decoded_user_id_from_cookie).to eq(team_member.id)
      end
    end
  end
end
