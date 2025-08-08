# frozen_string_literal: true

require "rails_helper"

RSpec.describe Internal::Companies::UsersController, type: :controller do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:other_user) { create(:user) }

  before do
    sign_in admin_user
    allow(controller).to receive(:current_context).and_return(
      CurrentContext.new(user: admin_user, company: company)
    )
    allow(controller).to receive(:Current).and_return(
      double(user: admin_user, company: company, company_administrator: company_administrator)
    )
  end

  describe "GET #index" do
    it "returns all users for the company" do
      get :index, params: { company_id: company.external_id }
      expect(response).to have_http_status(:ok)

      json_response = JSON.parse(response.body)
      expect(json_response).to have_key("administrators")
      expect(json_response).to have_key("lawyers")
      expect(json_response).to have_key("contractors")
      expect(json_response).to have_key("investors")
      expect(json_response).to have_key("all_users")
    end
  end

  describe "GET #list_administrators" do
    it "returns administrators for the company" do
      get :list_administrators, params: { company_id: company.external_id }
      expect(response).to have_http_status(:ok)

      json_response = JSON.parse(response.body)
      expect(json_response).to be_an(Array)
      expect(json_response.first["id"]).to eq(admin_user.external_id)
      expect(json_response.first["isAdmin"]).to be(true)
    end
  end

  describe "POST #add_role" do
    context "when adding admin role" do
      it "adds admin role to user" do
        post :add_role, params: {
          company_id: company.external_id,
          user_id: other_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:ok)
        expect(company.company_administrators.exists?(user: other_user)).to be(true)
      end
    end

    context "when adding lawyer role" do
      it "adds lawyer role to user" do
        post :add_role, params: {
          company_id: company.external_id,
          user_id: other_user.external_id,
          role: "lawyer",
        }

        expect(response).to have_http_status(:ok)
        expect(company.company_lawyers.exists?(user: other_user)).to be(true)
      end
    end

    context "when user already has the role" do
      before do
        create(:company_administrator, company: company, user: other_user)
      end

      it "returns error" do
        post :add_role, params: {
          company_id: company.external_id,
          user_id: other_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to include("already an administrator")
      end
    end
  end

  describe "DELETE #remove_role" do
    let!(:other_admin) { create(:company_administrator, company: company, user: other_user) }

    context "when removing admin role" do
      it "removes admin role from user" do
        delete :remove_role, params: {
          company_id: company.external_id,
          user_id: other_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:ok)
        expect(company.company_administrators.exists?(user: other_user)).to be(false)
      end
    end

    context "when trying to remove last admin" do
      before do
        other_admin.destroy!
      end

      it "returns error" do
        delete :remove_role, params: {
          company_id: company.external_id,
          user_id: admin_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to include("last administrator")
      end
    end

    context "when trying to remove own admin role" do
      it "returns error" do
        delete :remove_role, params: {
          company_id: company.external_id,
          user_id: admin_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to include("cannot remove your own admin role")
      end
    end
  end
end
