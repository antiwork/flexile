# frozen_string_literal: true

require "rails_helper"

RSpec.describe Admin::ImpersonationController, type: :controller do
  let(:admin_user) { create(:user, team_member: true) }
  let(:target_user) { create(:user, team_member: false) }

  before do
    allow(Current).to receive(:user=)
    allow(Current).to receive(:user).and_return(admin_user)
  end

  describe "GET #create" do
    context "with valid token" do
      it "impersonates the target user" do
        token = target_user.signed_id(purpose: :impersonate, expires_in: 5.minutes)

        get :create, params: { token: token }

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:notice]).to eq("Now impersonating #{target_user.display_name}")
        expect(session[:impersonator_id]).to eq(admin_user.id)
        expect(session[:impersonated_user_id]).to eq(target_user.id)
        expect(cookies[:auth_token]).to be_present
      end
    end

    context "with invalid token" do
      it "redirects with error" do
        get :create, params: { token: "invalid_token" }

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:alert]).to eq("Invalid or expired impersonation token")
      end
    end

    context "with expired token" do
      it "redirects with error" do
        token = target_user.signed_id(purpose: :impersonate, expires_in: -1.minute)

        get :create, params: { token: token }

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:alert]).to eq("Invalid or expired impersonation token")
      end
    end

    context "with blank token" do
      it "redirects with error" do
        get :create, params: { token: "" }

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:alert]).to eq("Invalid impersonation token")
      end
    end

    context "when user not found" do
      it "redirects with error" do
        fake_user = build(:user, id: 99999)
        token = fake_user.signed_id(purpose: :impersonate, expires_in: 5.minutes)

        get :create, params: { token: token }

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:alert]).to eq("User not found")
      end
    end
  end

  describe "DELETE #destroy" do
    context "with active impersonation" do
      before do
        session[:impersonator_id] = admin_user.id
        session[:impersonated_user_id] = target_user.id
      end

      it "stops impersonation and restores original user" do
        delete :destroy

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:notice]).to eq("Stopped impersonating, back to #{admin_user.display_name}")
        expect(session[:impersonator_id]).to be_nil
        expect(session[:impersonated_user_id]).to be_nil
        expect(cookies[:auth_token]).to be_present
      end
    end

    context "without active impersonation" do
      it "redirects with error" do
        delete :destroy

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:alert]).to eq("No active impersonation")
      end
    end

    context "when original user not found" do
      before do
        session[:impersonator_id] = 99999
        session[:impersonated_user_id] = target_user.id
      end

      it "redirects with error" do
        delete :destroy

        expect(response).to redirect_to(admin_root_path)
        expect(flash[:alert]).to eq("Original user not found")
      end
    end
  end
end
