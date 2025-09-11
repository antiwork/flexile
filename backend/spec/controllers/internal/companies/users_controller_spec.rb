# frozen_string_literal: true

RSpec.describe Internal::Companies::UsersController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:other_user) { create(:user) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    Current.user = admin_user
    Current.company = company
    Current.company_administrator = company_administrator

    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "GET #index" do
    it "calls the presenter with the filter parameter and returns the result" do
      presenter_double = instance_double(CompanyUsersPresenter)
      expected_result = [{ id: "user1", name: "Test User" }]

      allow(CompanyUsersPresenter).to receive(:new)
        .with(company: company)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:users)
        .with("administrators,lawyers")
        .and_return(expected_result)

      get :index, params: { company_id: company.external_id, filter: "administrators,lawyers" }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.map(&:with_indifferent_access))
      expect(presenter_double).to have_received(:users).with("administrators,lawyers")
    end

    it "calls the presenter with nil when no filter is provided" do
      presenter_double = instance_double(CompanyUsersPresenter)
      expected_result = [{ id: "user1", name: "Test User" }]

      allow(CompanyUsersPresenter).to receive(:new)
        .with(company: company)
        .and_return(presenter_double)
      allow(presenter_double).to receive(:users)
        .with(nil)
        .and_return(expected_result)

      get :index, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(expected_result.map(&:with_indifferent_access))
      expect(presenter_double).to have_received(:users).with(nil)
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

    context "when role is provided in different case" do
      it "normalizes the role and adds it" do
        post :add_role, params: {
          company_id: company.external_id,
          user_id: other_user.external_id,
          role: "Admin",
        }

        expect(response).to have_http_status(:ok)
        expect(company.company_administrators.exists?(user: other_user)).to be(true)
      end
    end

    context "when role is invalid" do
      it "returns unprocessable entity with error" do
        post :add_role, params: {
          company_id: company.external_id,
          user_id: other_user.external_id,
          role: "invalid_role",
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json_response = response.parsed_body
        expect(json_response["error"]).to match(/Invalid role/i)
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
        json_response = response.parsed_body
        expect(json_response["error"]).to include("already an administrator")
      end
    end
  end

  describe "POST #remove_role" do
    let!(:other_admin) { create(:company_administrator, company: company, user: other_user) }

    context "when removing admin role" do
      it "removes admin role from user" do
        post :remove_role, params: {
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
        post :remove_role, params: {
          company_id: company.external_id,
          user_id: admin_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json_response = response.parsed_body
        expect(json_response["error"]).to include("last administrator")
      end
    end

    context "when trying to remove own admin role" do
      it "returns error" do
        post :remove_role, params: {
          company_id: company.external_id,
          user_id: admin_user.external_id,
          role: "admin",
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json_response = response.parsed_body
        expect(json_response["error"]).to include("cannot remove your own admin role")
      end
    end
  end
end
